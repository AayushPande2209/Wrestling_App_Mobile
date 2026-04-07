# Pursuit — App Specification

> Source of truth for the Pursuit wrestling app. Read this before planning or reviewing any work.

---

## 1. App Overview

**Pursuit** is a training tool for individual wrestlers at Pursuit Wrestling Club, Powell OH. The expected user base is ~50 wrestlers.

**Problem it solves:** Wrestlers track weight, matches, and practice notes in scattered places (notes apps, paper, memory). Pursuit centralises everything in one dashboard and adds ML-driven predictions — weight cut planning and match outcome probability — that turn logged data into actionable insight.

**MVP scope:**
- Each wrestler has a private account. No coach view, no team-wide data (except opt-in features below).
- Log weight daily, track matches and notes, manage a personal schedule.
- Log lifting workouts with per-exercise tracking (sets, reps, weight).
- Set and track goals — auto-tracked (lifting count, practice attendance, daily habits) and manual (tournament placement, other).
- Two ML predictions: weight cut safety analysis and match outcome probability.
- Personal records, season timeline, and streak tracking for progress visibility.
- Opt-in team weight board and teammate activity feed — wrestlers choose to share via `show_on_board` toggle; default is private.

---

## 2. Tech Stack

| Layer | Technology | Deployment |
|-------|-----------|------------|
| Frontend | React 18 + Vite + Tailwind CSS | Vercel |
| Backend | FastAPI (ML endpoints only) | Fly.io (`wrestling-api`, region `ord`) |
| Database | Supabase (PostgreSQL + Auth + RLS) | Supabase cloud |
| ML | scikit-learn (LinearRegression, LogisticRegression) | Bundled in FastAPI container |
| Charts | Recharts | — |
| Fonts | Chakra Petch (UI), JetBrains Mono (numbers/stats) | Google Fonts |

**Frontend env vars:**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key
- `VITE_API_URL` — FastAPI base URL (e.g. `https://wrestling-api.fly.dev`)

**Backend env vars:**
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only, never exposed to client)
- `SUPABASE_JWT_SECRET` — Supabase JWT secret for validating wrestler tokens
- `FRONTEND_URL` — production frontend URL (e.g. `https://pursuit.vercel.app`); added to CORS allowed origins in `main.py`; omit for local-only dev
- `USDA_API_KEY` — USDA FoodData Central API key (free, get at api.nal.usda.gov); used by `app/services/food.py` for meal suggestions; falls back to hardcoded meals if absent

---

## 3. Architecture

```
Browser (React)
    │
    ├── Supabase JS client ──────────────────► Supabase (all CRUD)
    │   - direct table reads/writes                 wrestlers, weight_logs, matches,
    │   - auth (signUp, signIn, signOut)             notes, schedules, tournaments,
    │   - RPC (insert_lifting_workout)               workouts, workout_exercises,
    │   - JWT issued on login                        goals, habit_logs
    │
    └── fetch() with Bearer token ──────────► FastAPI (ML only)
                                                POST /predict/weight-cut
                                                POST /predict/weight-trend
                                                GET  /predict/performance-trend
                                                POST /predict/match-outcome
                                                POST /predict/meal-plan
                                                POST /predict/recovery-protocol
                                                        │
                                                        └── supabase-py (service role)
                                                            reads weight_logs, matches
```

**Key rules:**
- React never calls FastAPI for CRUD — only for predictions.
- FastAPI never writes to Supabase — read only, using the service role key.
- All FastAPI endpoints validate the Supabase JWT via JWKS (fetches the public key from Supabase's `/.well-known/jwks.json`; accepts `ES256` and `HS256`, audience `authenticated`). The wrestler's UUID is extracted from `payload["sub"]`.
- If FastAPI is unreachable, prediction UI is hidden silently. No page breaks.

---

## 4. Database Schema

### `wrestlers`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, references `auth.users(id)` |
| `email` | `text` | set on sign-up from `auth.users.email`; read-only in UI |
| `name` | `text` | user-chosen display name; editable in Profile |
| `current_weight` | `float` | — |
| `weight_class` | `int` | — |
| `show_on_board` | `boolean` | default `false`; opt-in for the team weight board and activity feed |

**RLS:** Wrestlers can only read and update their own row (`id = auth.uid()`). Exception: the `/board` page reads all wrestlers where `show_on_board = true` — this requires a separate RLS policy that allows `SELECT` on rows where `show_on_board = true` for any authenticated user.

---

### `weight_logs`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `wrestler_id` | `uuid` | FK → `wrestlers(id)` |
| `weight` | `float` | NOT NULL |
| `time_of_day` | `text` | NOT NULL; `'morning'` \| `'before_practice'` \| `'after_practice'` \| `'night'` |
| `note` | `text` | nullable |
| `logged_at` | `timestamptz` | default `now()` |

**RLS:** Wrestlers can only select/insert rows where `wrestler_id = auth.uid()`.

---

### `matches`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `wrestler_id` | `uuid` | FK → `wrestlers(id)` |
| `opponent_name` | `text` | — |
| `result` | `text` | `'win'` \| `'loss'` \| `'draw'` |
| `score` | `text` | nullable (e.g. `"8-2"`) |
| `win_type` | `text` | nullable; `'decision'` \| `'major'` \| `'tech'` \| `'pin'` \| `'forfeit'` |
| `tournament_id` | `uuid` | nullable, FK → `tournaments(id)`, on delete set null |
| `match_date` | `date` | NOT NULL |
| `created_at` | `timestamptz` | default `now()` |

**Note:** `match_date` is the actual date of the match (user-entered). `created_at` is the row insertion time. All ordering and ML queries use `match_date`. The `tournament_id` FK replaced the old free-text `tournament` column; existing rows may still have a legacy `tournament` text value (the frontend falls back to it for display).

**RLS:** Wrestlers can only select/insert rows where `wrestler_id = auth.uid()`.

---

### `notes`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `wrestler_id` | `uuid` | FK → `wrestlers(id)` |
| `body` | `text` | NOT NULL |
| `context` | `text` | default `'general'`; `'general'` \| `'practice'` \| `'match'` |
| `match_id` | `uuid` | nullable, FK → `matches(id)` |
| `created_at` | `timestamptz` | default `now()` |

**RLS:** Wrestlers can only select/insert rows where `wrestler_id = auth.uid()`.

---

### `schedules`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `wrestler_id` | `uuid` | FK → `wrestlers(id)` |
| `title` | `text` | NOT NULL |
| `event_type` | `text` | `'practice'` \| `'tournament'` \| `'dual meet'` \| `'other'` |
| `starts_at` | `timestamptz` | NOT NULL |
| `ends_at` | `timestamptz` | nullable |
| `location` | `text` | nullable |

**RLS:** Wrestlers can only select/insert/update rows where `wrestler_id = auth.uid()`.

---

### `tournaments`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `wrestler_id` | `uuid` | FK → `wrestlers(id)`, NOT NULL |
| `name` | `text` | NOT NULL |
| `date` | `date` | nullable |

**RLS:** Wrestlers can only select/insert/delete their own rows (`wrestler_id = auth.uid()`).

Used as a normalized lookup for both `matches.tournament_id` and `goals.tournament_id`. The frontend shows a dropdown of existing tournaments plus an "Add new" option when logging a match or creating a tournament placement goal.

---

### `workouts`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `wrestler_id` | `uuid` | FK → `wrestlers(id)`, NOT NULL |
| `workout_type` | `text` | NOT NULL, default `'lifting'`; `'lifting'` \| `'practice'` \| `'cardio'` \| `'other'` |
| `workout_date` | `date` | NOT NULL |
| `duration_minutes` | `int` | nullable (used for practice/cardio/other types) |
| `notes` | `text` | nullable |
| `created_at` | `timestamptz` | default `now()` |

**RLS:** Wrestlers can select/insert/update/delete their own rows (`wrestler_id = auth.uid()`).

---

### `workout_exercises`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `workout_id` | `uuid` | FK → `workouts(id)`, on delete cascade, NOT NULL |
| `wrestler_id` | `uuid` | FK → `wrestlers(id)`, NOT NULL |
| `name` | `text` | NOT NULL |
| `sets` | `int` | nullable |
| `reps` | `int` | nullable |
| `weight` | `float` | nullable (lbs) |
| `created_at` | `timestamptz` | default `now()` |

**RLS:** Wrestlers can select/insert/delete their own rows (`wrestler_id = auth.uid()`).

**Note:** `wrestler_id` is intentionally redundant with `workouts.wrestler_id` — Supabase RLS cannot join through parent tables, so both tables need the FK for policy checks. The `insert_lifting_workout` RPC derives both from `auth.uid()`.

---

### `goals`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `wrestler_id` | `uuid` | FK → `wrestlers(id)`, NOT NULL |
| `goal_type` | `text` | NOT NULL; `'lifting'` \| `'practice'` \| `'habit'` \| `'tournament_placement'` \| `'other'` |
| `tracking_type` | `text` | NOT NULL; `'auto'` \| `'manual'` |
| `description` | `text` | NOT NULL |
| `target` | `int` | nullable (weekly count for auto goals) |
| `progress` | `int` | default `0`; check `>= 0 AND <= 100` |
| `target_date` | `date` | nullable |
| `tournament_id` | `uuid` | nullable, FK → `tournaments(id)`, on delete set null |
| `completed` | `boolean` | default `false` |
| `completed_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | default `now()` |

**Check constraints:**
- `goal_type` must be one of the five allowed values
- `tracking_type` must be `'auto'` or `'manual'`
- `progress >= 0 AND progress <= 100`
- Compound: lifting/practice/habit → `tracking_type = 'auto'`; tournament_placement/other → `tracking_type = 'manual'`

**RLS:** Wrestlers can select/insert/update/delete their own rows (`wrestler_id = auth.uid()`).

---

### `habit_logs`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `goal_id` | `uuid` | FK → `goals(id)`, on delete cascade, NOT NULL |
| `wrestler_id` | `uuid` | FK → `wrestlers(id)`, NOT NULL |
| `logged_at` | `timestamptz` | default `now()` |

**RLS:** Wrestlers can select/insert/delete their own rows (`wrestler_id = auth.uid()`).

Used to track daily habit completion. The frontend prevents logging more than once per day (client-side check: `logged_at >= start of today` in local timezone).

---

## 5. API Endpoints

All endpoints are mounted under `/predict`. FastAPI runs on Fly.io. All require a valid Supabase JWT in `Authorization: Bearer <token>`.

---

### `POST /predict/weight-cut`
**Auth:** Required  
**Status:** Implemented

**Request body:**
```json
{
  "current_weight": 158.5,
  "target_weight_class": 152,
  "days_until_weigh_in": 7
}
```
`days_until_weigh_in` must be `> 0` (Pydantic `Field(gt=0)`).

**Response:**
```json
{
  "lbs_to_cut": 6.5,
  "daily_cut_rate": 0.93,
  "is_safe": true,
  "recommendation": "Cut 0.9 lbs/day. You're on track."
}
```
`is_safe` is `true` if `daily_cut_rate < current_weight * 0.015` (1.5% body weight/day threshold). Pure math, no DB access.

---

### `POST /predict/weight-trend`
**Auth:** Required  
**Status:** Implemented

**Request body:**
```json
{
  "target_date": "2026-04-15"
}
```
Invalid ISO date returns `400`.

**Response:**
```json
{
  "predicted_weight": 154.2,
  "confidence": "medium"
}
```
Queries `weight_logs` for the wrestler, fits a `LinearRegression` on (days since first log → weight), predicts for `target_date`. Confidence: `"low"` if < 7 logs, `"medium"` if 7–19, `"high"` if 20+. If fewer than 2 logs, returns current weight with `"low"`.

---

### `GET /predict/performance-trend`
**Auth:** Required  
**Status:** Implemented

**Response:**
```json
{
  "win_rate": 0.6667,
  "recent_win_rate": 0.8,
  "trend": "improving",
  "insight": "You win 67% of your matches overall, and you're trending up recently."
}
```
Queries `matches` ordered by `match_date`. `trend` is `"improving"` if `recent_win_rate > win_rate + 0.10`, `"declining"` if `recent_win_rate < win_rate - 0.10`, else `"stable"`. Uses last 10 matches for `recent_win_rate`. Returns neutral defaults with insight if no matches exist.

---

### `POST /predict/match-outcome`
**Auth:** Required  
**Status:** Implemented

**Request body:**
```json
{
  "your_weight_on_day": 155.0,
  "target_weight_class": 152
}
```

**Response:**
```json
{
  "win_probability": 0.72,
  "confidence": "medium",
  "factors": [
    "You're 3.0 lbs over your weight class",
    "Strong recent form — 4 wins in last 5 matches",
    "High pin rate (60%) shows finishing strength"
  ]
}
```
Cold start: if fewer than 10 matches, returns `win_probability: 0.5`, `confidence: "low"`, single factor explaining the cold start.  
Model: `LogisticRegression` trained on per-match rolling features (rolling win rate over last 5, rolling pin rate). `lbs_from_class` is applied as a post-model adjustment (−1% per lb over class). Confidence: `"medium"` for 10–29 matches, `"high"` for 30+.

---

### `POST /predict/meal-plan`
**Auth:** Required  
**Status:** Implemented

**Request body:**
```json
{
  "current_weight": 158.5,
  "target_weight_class": 152,
  "days_until_weigh_in": 7
}
```
Reuses `WeightCutRequest`. `days_until_weigh_in` must be `> 0`.

**Response:**
```json
{
  "daily_calories": 2100,
  "daily_macros": { "protein": 158, "carbs": 210, "fat": 58, "sodium": 1200 },
  "sodium_target": 1500,
  "sodium_warning": false,
  "meals": [
    { "meal_type": "breakfast", "name": "Oatmeal", "calories": 400, "protein": 25, "carbs": 45, "fat": 10, "sodium": 300 },
    { "meal_type": "lunch",     "name": "Grilled Chicken Breast", "calories": 500, "protein": 40, "carbs": 50, "fat": 8, "sodium": 500 },
    { "meal_type": "dinner",    "name": "Baked Salmon Fillet", "calories": 450, "protein": 35, "carbs": 40, "fat": 12, "sodium": 400 }
  ]
}
```
Calorie math: `base = current_weight × 15`, `deficit = (lbs_to_cut / days) × 3500`, `target = max(1200, base − deficit)`. Macros: `protein = current_weight × 1.0g`, `fat = target × 0.25 / 9`, `carbs = remaining / 4`. `sodium_warning` is `true` if combined meal sodium exceeds 1500 mg (high sodium causes water retention during a cut). Meals fetched from USDA FoodData Central via `app/services/food.py`; falls back to hardcoded meals if API is unavailable.

---

### `POST /predict/recovery-protocol`
**Auth:** Required  
**Status:** Implemented

**Request body:**
```json
{
  "weight_before_cut": 158.5,
  "weight_after_cut": 152.0,
  "hours_until_match": 4
}
```
`hours_until_match` must be `> 0`.

**Response:**
```json
{
  "fluids_oz": 104.0,
  "sodium_target_mg": 1500,
  "meals": [...],
  "timeline": [
    { "hours_before_match": 4, "action": "Drink 16oz water with electrolytes immediately — aim for a drink containing at least 300mg sodium" },
    { "hours_before_match": 2, "action": "Eat recovery meal — high carb, moderate protein, low fat" },
    { "hours_before_match": 0.5, "action": "Light snack (banana, crackers). Stop drinking large amounts." }
  ]
}
```
`fluids_oz = (weight_before_cut − weight_after_cut) × 16`. Timeline has 3 steps if `hours >= 3`, 1 step (sip slowly) if `< 3`. `sodium_target_mg: 1500` — wrestlers need to replenish sodium after cutting to retain rehydration fluids. Meals fetched via same `get_meals()` function as meal-plan with recovery-appropriate macro targets.

---

### `RPC: insert_lifting_workout`
**Auth:** Required (uses `auth.uid()` internally)  
**Status:** Implemented

A Postgres function (`security definer`) that inserts a workout and its exercises in a single transaction. Prevents orphaned workout rows if the exercise insert fails.

**Parameters:**
```json
{
  "p_workout_date": "2026-04-05",
  "p_notes": "optional text",
  "p_exercises": [{"name": "Squat", "sets": 5, "reps": 3, "weight": 225}]
}
```

**Returns:** `uuid` — the new workout's ID.

**Behavior:** Inserts one row into `workouts`, then loops `p_exercises` and inserts one row per element into `workout_exercises`. Both `workouts.wrestler_id` and `workout_exercises.wrestler_id` are derived from `auth.uid()` — never from client input.

Called from the frontend via `supabase.rpc('insert_lifting_workout', {...})`. Only used for new workout creation; edits use direct update + delete/re-insert (non-transactional, acceptable trade-off per TODO).

---

## 6. Pages

### `/auth` — Auth
**Status:** Built  
**Tables:** `auth.users` (via Supabase Auth), `wrestlers` (insert on sign-up)  
**FastAPI:** None

Toggle between sign-in and sign-up. Email + password only. On sign-up: calls `supabase.auth.signUp` then inserts a row into `wrestlers` with `id = user.id`, `email = email`, and `name = email` (temporary default). On success, redirects to `/profile/setup` for first-time onboarding. On sign-in, redirects to `/dashboard`.

**Duplicate email detection:** Supabase returns a fake-success response (no error, `data.user.identities` is an empty array) when signing up with an already-registered email to prevent enumeration. Auth.jsx checks for this case and displays: "An account with this email already exists. Try signing in instead."

**Forgot password:** A "Forgot password?" link on the sign-in tab switches to a reset-request form. On submit, calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })` and shows "Check your email for a reset link." The emailed link redirects to `/reset-password`.

> **Known issue:** Race condition — if the `wrestlers` insert fails after a successful `auth.signUp`, the user exists in auth but has no wrestlers row. Mitigation: backfill with `insert into wrestlers (id, name) select id, email from auth.users on conflict (id) do nothing`. Permanent fix: add a Supabase database trigger on `auth.users` insert.

---

### `/reset-password` — Reset Password
**Status:** Built  
**Tables:** None  
**FastAPI:** None

Public route (not wrapped in ProtectedRoute). Landed on from the emailed password-reset link, which appends a recovery token to the URL hash. Supabase SDK processes the hash automatically and fires the `PASSWORD_RECOVERY` auth event; the page listens for this event via `onAuthStateChange` and shows the new-password form once the temporary session is live. On submit, calls `supabase.auth.updateUser({ password })`. On success, navigates to `/dashboard`.

---

### `/profile/setup` — Profile Setup (Onboarding)
**Status:** Built  
**Tables:** `wrestlers` (read and update `name`, `weight_class`)  
**FastAPI:** None

One-time onboarding page shown after sign-up. Wrapped in `ProtectedRoute` but not in `Layout` (no sidebar). On mount, checks if the wrestler already has a real name set (i.e. `name` does not equal `email`); if so, redirects to `/dashboard` immediately — ensures this page is only shown once.

**Form:** Name input (text, required), weight class input (number, optional). Submit button ("Get started") updates the `wrestlers` row. On success, redirects to `/dashboard`. A "Skip for now" link below the form navigates to `/dashboard` without updating — the wrestler can set their name later in `/profile`.

**Email privacy:** The wrestler's email is used as the temporary `name` on sign-up, but is never displayed in the UI. All components that show a wrestler's name use a `safeName` pattern: if `name` contains `@`, display "Wrestler" instead. This prevents email leakage in the sidebar, Dashboard greeting, activity feed, and Board page.

---

### `/dashboard` — Dashboard
**Status:** Built  
**Tables:** `wrestlers` (read), `weight_logs` (read latest 1; read all for streak calculation; read recent from opted-in teammates for activity feed), `matches` (read all results; read recent from opted-in teammates for activity feed), `schedules` (read next upcoming; read recent from opted-in teammates for activity feed)  
**FastAPI:** `POST /predict/weight-cut` (called only if `weight_class`, latest log, and next event all exist; fails silently if unreachable), `GET /predict/performance-trend` (always called; fails silently if unreachable)

Displays: current weight, weight class, lbs to cut ("ON WEIGHT" when wrestler is already at or below class; highlighted amber if > 5 lbs), W–L record, logging streak (consecutive days with a weight log entry, computed client-side from `weight_logs` ordered by `logged_at`), next event card, cut analysis card (if prediction available), performance trend card (win rate, recent win rate, trend, insight). Teammate activity feed showing recent weight logs, match results, and schedule events from the last 48 hours — only from wrestlers with `show_on_board = true`; shows wrestler name, action, and timestamp. Quick action buttons navigate to `/weight`, `/matches`, `/notes`.

---

### `/weight` — Weight Log
**Status:** Built  
**Tables:** `weight_logs` (read last 30, insert), `wrestlers` (update `current_weight` on insert)  
**FastAPI:** `POST /predict/weight-cut` (cut predictor form, user-triggered; fails silently if unreachable), `POST /predict/weight-trend` (weight trend predictor form, user-triggered; fails silently if unreachable)

Three panels: log weight form (weight + optional note), cut predictor form (target class + days), weight trend predictor form (target date → predicted weight + confidence). Line chart (Recharts) of last 30 weight logs below. On weight log insert, also updates `wrestlers.current_weight`.

---

### `/matches` — Matches
**Status:** Built  
**Tables:** `matches` (read all, insert)  
**FastAPI:** `POST /predict/match-outcome` (match outcome predictor form, user-triggered; fails silently if unreachable)

W–L record shown at top. Add match form: opponent name, result (win/loss/draw), score (text), win type (decision/major/tech/pin/forfeit — only shown when result = win), tournament (dropdown of existing tournaments from `tournaments` table, with "Add new" option that creates a new tournament inline; optional), date. Match outcome predictor form: enter weight on day + target class → win probability, confidence, factors. Shows a hint when fewer than 10 matches are logged (cold-start). Match list ordered by `match_date` descending; tournament name displayed via join to `tournaments` table (falls back to legacy `tournament` text for old rows).

---

### `/notes` — Notes
**Status:** Built  
**Tables:** `notes` (read all, insert), `matches` (read all for match selector dropdown, ordered by `match_date` descending)  
**FastAPI:** None

Add note form: context (general/practice/match), optional linked match (dropdown of all matches), note body (textarea). Notes list ordered by `created_at` descending, filterable by context. Each note shows context badge, timestamp (date + time), and body.

---

### `/profile` — Profile
**Status:** Built  
**Tables:** `wrestlers` (read and update `name`, `weight_class`, `show_on_board`)  
**FastAPI:** None

Shows `email` (read-only, from sign-up) and editable `name`, `weight_class`, and `show_on_board` fields. The `show_on_board` toggle controls whether the wrestler appears on the `/board` team weight board and in the teammate activity feed — default is `false` (opted out). Changes saved via a `wrestlers.update()` call scoped to `name`, `weight_class`, and `show_on_board` only — email is never written from this form. Setting `weight_class` here is required for the Dashboard cut analysis card to appear. `weight_class` accepts any integer (no enum constraint — matches the DB schema). `current_weight` is not editable here; it updates automatically on every weight log insert.

---

### `/schedule` — Schedule
**Status:** Built  
**Tables:** `schedules` (read all, insert)  
**FastAPI:** None

Add event form: title, type (practice/tournament/dual meet/other), start time, optional end time, optional location. Validates that end time is after start time before inserting. Upcoming events shown at full opacity ordered by `starts_at` asc. Past events shown below at 35% opacity in reverse chronological order.

---

### `/records` — Personal Records
**Status:** Built  
**Tables:** `matches` (read all)  
**FastAPI:** None

Computes personal records automatically from the wrestler's existing match data — no new tables or columns needed. Records include: most recent pin (latest match where `win_type = 'pin'`, ordered by `match_date` descending), biggest point differential (parsed from `score` field, e.g. `"8-2"` → differential of 6), longest win streak (consecutive wins ordered by `match_date`), best tournament placement (derived from win/loss at each `tournament`). All computation happens client-side in JS. Records update automatically as new matches are logged.

---

### `/timeline` — Season Timeline
**Status:** Built  
**Tables:** `weight_logs` (read all), `matches` (read all)  
**FastAPI:** None

Visual scrollable timeline showing weight logs and match results together on one Recharts chart. Weight plotted as a line on the Y-axis, match results overlaid as markers (green dot for win, red for loss, grey for draw). X-axis is date. Pulls from existing `weight_logs` and `matches` tables — no new data needed. Gives wrestlers a single view of how their weight trends correlate with competition performance over a season.

---

### `/board` — Team Weight Board
**Status:** Built  
**Tables:** `wrestlers` (read all where `show_on_board = true`)  
**FastAPI:** None

Public-within-the-club leaderboard showing all wrestlers who have opted in via the `show_on_board` toggle on their Profile page. Displays each opted-in wrestler's `name`, `current_weight`, `weight_class`, and lbs to cut. Sorted by weight class ascending. Read-only — no inserts or updates from this page. Requires a separate RLS policy: any authenticated user can `SELECT` rows from `wrestlers` where `show_on_board = true`.

> **Privacy:** Only wrestlers who explicitly set `show_on_board = true` on their Profile appear. The default is `false` — new sign-ups are not visible on the board.

---

### `/workouts` — Workouts
**Status:** Built  
**Tables:** `workouts` (read, insert, update, delete), `workout_exercises` (read, insert, delete)  
**FastAPI:** None  
**RPC:** `insert_lifting_workout` (new workout creation)

Workout logger supporting multiple types. The user first selects a workout type (lifting, practice, cardio, other) from a button group.

**Lifting form:** Workout date, optional notes, and a dynamic exercise table with columns: exercise name (text), weight (lbs), sets, reps. An "Add row" button appends a new empty row; each row has a remove button. Minimum 1 exercise required to submit. **Practice/Cardio/Other forms:** Workout date, duration (minutes, required), and optional notes — no exercise rows.

**New lifting workout:** Calls `insert_lifting_workout` RPC for atomic insert (workout + all exercises in a single transaction). Non-lifting types use a direct `workouts` insert (no exercises). **Edit workout:** Re-opens the form pre-filled with existing data. For lifting: updates the workout row directly, then deletes all existing exercises and re-inserts new ones (3 separate calls — non-transactional, acceptable trade-off). **Delete:** Confirmation dialog, then deletes the workout row (exercises cascade).

Below the form: paginated list of past workouts (15 per page), ordered by `workout_date` descending. Each row shows date, type badge, duration (if present), exercise count (for lifting), and notes preview. Clicking a lifting workout row expands it to show full exercise details — exercises are fetched on demand via a separate React Query call (`queryKey: ['workout_exercises', workout.id]`, `staleTime: 60000`) to avoid loading N exercises × 15 workouts eagerly.

**Cache invalidation:** After any create/edit/delete, invalidates both `['workouts', uid]` and `['goals', uid]` (since lifting goals depend on workout count).

---

### `/goals` — Goals
**Status:** Built  
**Tables:** `goals` (read, insert, update, delete), `tournaments` (read for dropdown), `workouts` (read for lifting progress), `schedules` (read for practice progress), `habit_logs` (read/insert for habit progress)  
**FastAPI:** None

Goal tracker with auto and manual progress modes.

**Create form:** Goal type dropdown (`lifting (auto)`, `practice attendance (auto)`, `daily habit (auto)`, `tournament placement (manual)`, `other (manual)`), description (text), target (number — shown only for auto types; represents weekly count), target date, tournament dropdown (shown only for `tournament_placement` type — reads from `tournaments` table).

**Progress computation per goal type (all live, never stored for auto types):**
- **lifting:** Count of `workouts` this week ÷ target × 100
- **practice:** Count of `schedules` with `event_type = 'practice'` this week ÷ target × 100
- **habit:** Count of `habit_logs` this week for this goal ÷ target × 100
- **tournament_placement:** Manual — stored `progress` value; wrestler clicks "Mark complete"
- **other:** Manual — stored `progress` value; wrestler clicks "Mark complete"

All "this week" computations use the user's local timezone with `date-fns` `startOfWeek` / `endOfWeek` (week starts Monday). Boundaries are passed as ISO strings to Supabase `.gte()` / `.lte()` filters.

**Auto-completion:** When a computed progress reaches 100%, a `useEffect` writes `completed = true` and `completed_at = now()` to the goal row. This is a one-way latch — once completed, it never reverts even if progress later drops below 100%. The guard `if (!goal.completed)` prevents repeated writes on re-renders.

**Manual completion:** Tournament placement and other goals show a "Mark complete" button. Clicking it sets `completed = true`, `completed_at = now()`, and `progress = 100`.

**Habit logging:** Habit goal cards show a "Log today" button that inserts a row into `habit_logs`. The button is disabled if the wrestler has already logged today (`logged_at >= start of today` in local timezone). The card displays logs this week vs target.

**Display:** Active goals shown as cards with a progress bar, current vs target, and days remaining. Goals past their `target_date` or with `completed = true` move to a collapsed "Past Goals" section, showing a "succeeded" (completed) or "expired" (not completed) badge.

**Delete:** Confirmation dialog on each goal card. No edit — delete and recreate is simpler.

**React Query keys:** `['goals', uid]` (staleTime: 30s), `['tournaments', uid]` (60s), `['workouts-week', uid, weekStartDate]` (30s), `['practices-week', uid, weekStartISO]` (30s), `['habit-logs-week', uid, weekStartISO]` (10s).

---

### `/nutrition` — Nutrition
**Status:** Built  
**Tables:** None  
**FastAPI:** `POST /predict/meal-plan`, `POST /predict/recovery-protocol` (both user-triggered; fail silently if unreachable)

Two sections:

**Cut Meal Planner:** Form takes current weight, target weight class, and days until weigh-in. On submit, calls `POST /predict/meal-plan`. Results show a daily targets row (calories, protein, carbs, fat, sodium) and three meal cards (breakfast, lunch, dinner), each showing name, macros, and sodium. If `sodium_warning` is true, an amber inline warning is shown below the targets. Fails silently with inline message "Meal suggestions unavailable right now."

**Post Weigh-In Recovery:** Form takes weight before cut, weight after weigh-in, and hours until first match. On submit, calls `POST /predict/recovery-protocol`. Results show fluids target (oz), a vertical timeline of actions with T-minus labels, a sodium tip ("aim for 1500–2000mg sodium — choose electrolyte drinks and lightly salted foods"), and recovery meal cards. Fails silently with the same inline message.

**React Query keys:** `['meal-plan', inputs]` and `['recovery', inputs]`, both `staleTime: 300000` (5 min — meal suggestions don't need to refresh often). Both use `retry: false`.

---

## 7. Auth Rules

- **Sign up:** `supabase.auth.signUp` → check `data.user.identities` (empty array = duplicate email, show error) → insert row into `wrestlers` with `name = email` as temporary default (client-side, in `Auth.jsx`) → redirect to `/profile/setup` for onboarding. Known race condition — see Auth page note above.
- **Duplicate email:** Supabase prevents enumeration by returning a fake success. `Auth.jsx` detects the empty-identities case and surfaces a user-readable error before attempting the wrestlers insert.
- **Forgot password:** `supabase.auth.resetPasswordForEmail(email, { redirectTo })` sends an email with a magic link pointing at `/reset-password`. The link contains a short-lived recovery token in the URL hash.
- **Password reset:** `/reset-password` is a public route. It subscribes to `onAuthStateChange`, waits for the `PASSWORD_RECOVERY` event (fired when Supabase exchanges the URL token for a session), then calls `supabase.auth.updateUser({ password })` with the new password the wrestler enters.
- **Session persistence:** `ProtectedRoute` calls `supabase.auth.getSession()` on mount and subscribes to `supabase.auth.onAuthStateChange` to detect expiry in real time. Session expiry redirects to `/auth` immediately.
- **Protected routes:** All routes except `/auth` and `/reset-password` are wrapped in `ProtectedRoute`. `/` redirects to `/dashboard` if logged in. `/profile/setup` is also protected but not wrapped in `Layout` (no sidebar). All other pages (`/records`, `/timeline`, `/board`, `/workouts`, `/goals`, `/nutrition`) follow the standard `ProtectedRoute` + `Layout` pattern.
- **FastAPI auth:** Every endpoint uses `Depends(get_current_user)`. The dependency fetches the signing key from Supabase's JWKS endpoint (`/.well-known/jwks.json`) and validates the JWT with `PyJWT` using `ES256` (primary) or `HS256` (fallback), audience `authenticated`. `payload["sub"]` is the wrestler's UUID used to scope all DB queries.
- **RLS:** Supabase RLS ensures wrestlers can only read/write their own rows in `weight_logs`, `matches`, `notes`, and `schedules`. The frontend uses the anon key (RLS enforced). The backend uses the service role key (bypasses RLS intentionally — the JWT sub is used to manually scope all queries). **Exception for team features:** the `/board` page and activity feed need to read data from other wrestlers who have opted in (`show_on_board = true`). This requires additional RLS policies: (1) `wrestlers`: any authenticated user can `SELECT` rows where `show_on_board = true`; (2) `weight_logs`, `matches`, `schedules`: any authenticated user can `SELECT` rows whose `wrestler_id` references a wrestler with `show_on_board = true`.
- **Service role key:** Only present in the FastAPI backend environment. Never sent to or accessible by the browser.

---

## 8. Out of Scope for MVP

The following are explicitly not being built:

- **Coach/admin role** — no view across multiple wrestlers, no team roster management
- **Mobile app** — web only; no React Native, no PWA features
- **External tournament data** — no Trackwrestling integration, no automatic match import
- **Team-wide analytics** — no aggregated stats or comparison between wrestlers (the opt-in weight board shows individual data, not aggregated team metrics)
- **Push notifications** — no weigh-in reminders, no event alerts
- **Social features** — no commenting, no following (the opt-in weight board and activity feed are accountability tools, not social networking)
- **Video** — no match film upload or analysis
- **Weight cut automation** — no real-time wearable integration
