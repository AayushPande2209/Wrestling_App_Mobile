# Pursuit Wrestling App — Todo List
 
## How this works
- **Planner** finds issues and adds them here
- **Builder** picks the next unchecked item and implements it
- **Reviewer** checks the work, writes tests, then marks it done
- One item at a time. Builder does not move on until Reviewer marks it complete.
 
---
 
## Backend
 
- [x] Add Supabase database trigger to auto-insert into `wrestlers` when a new user signs up in `auth.users` — eliminates the race condition where sign-up succeeds but the wrestlers row doesn't exist yet
- [x] Implement `predict_weight_trend` in `routers/weight.py` — linear regression on `weight_logs` time series using scikit-learn
- [x] Implement `predict_match_outcome` in `routers/performance.py` — logistic regression on match history, cold start fallback if fewer than 10 matches
 
---
 
## Frontend
 
- [x] `Auth.jsx` — sign up / login page
- [x] `Layout.jsx` — persistent sidebar nav + sign out
- [x] `ProtectedRoute.jsx` — redirect to `/auth` if no session
- [x] `Dashboard.jsx` — current weight, lbs to cut, win/loss record, next event, weight cut prediction from FastAPI
- [x] `WeightLog.jsx` — log weight form, line chart of history, cut predictor UI
- [x] `Matches.jsx` — add match form, past matches list, W-L record
- [x] `Notes.jsx` — add note form, notes list filterable by context
- [x] `Schedule.jsx` — add event form, upcoming and past events
- [x] Add wrestler profile/settings page — no UI exists to set `weight_class` or update `name` after sign-up; on sign-up only `name = email` is stored and `weight_class` is null, so the Dashboard cut prediction card (which requires `weight_class`) never appears for new users
- [x] Add UI for `GET /predict/performance-trend` — backend endpoint is fully implemented and returns `win_rate`, `recent_win_rate`, `trend`, and `insight`, but no frontend page fetches or displays this data
- [x] Add UI for `POST /predict/match-outcome` — backend endpoint is fully implemented but no page or form calls it; per spec this prediction should be accessible to wrestlers
- [x] Add UI for `POST /predict/weight-trend` — backend endpoint is fully implemented (predicts weight on a target date) but `WeightLog.jsx` only has the cut predictor form and never calls this endpoint
- [x] `Dashboard.jsx` — lbs-to-cut stat shows a negative number when the wrestler is already under their weight class (`latestLog.weight - wrestler.weight_class` goes negative); should display `0` or "ON WEIGHT" in that case
- [x] `Schedule.jsx` — no validation that `ends_at > starts_at` before inserting; a user can accidentally submit an end time before the start time and store invalid data
- [x] `WeightLog.jsx` — cut predictor shows an error message when FastAPI is unreachable (`setCutError(err.message)`), but spec §3 says "If FastAPI is unreachable, prediction UI is hidden silently. No page breaks." — should fail silently like `Dashboard.jsx` does
- [x] `Notes.jsx` — match-link dropdown only loads last 10 matches (`limit(10)`); users cannot link a note to any older match, which gets worse over time as more matches are logged
 
---
 
## Infrastructure
 
- [x] Add `.env.example` for the React project (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`)
- [x] Configure Vercel deployment for the React frontend
- [x] Set Fly.io secrets for FastAPI (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`)
- [ ] `fly.toml` — app name is placeholder `wrestling-api` with a TODO comment; replace with the actual Fly.io app name before deploying or the deploy will fail / target the wrong app
- [x] Add `sql/schema.sql` with full table-creation DDL for all five tables (`wrestlers`, `weight_logs`, `matches`, `notes`, `schedules`) plus RLS policies — currently no schema migration exists so there is no reproducible way to create the database; the only SQL file is `sql/create_wrestler_on_signup.sql` (the trigger)
 
---
 
## Known Issues
 
- [x] Sign-up race condition between `auth.users` and `wrestlers` table — fixed by the trigger above (first backend todo)
- [x] `WeightLog.jsx` — `loadLogs` silently swallows all DB errors (catch block is `// ignore`); if the Supabase query fails the user sees a blank chart with no feedback
- [x] SPEC.md §2 Backend env vars table is missing `FRONTEND_URL` — added in `wrestling-api/.env.example` and used by `main.py` for CORS origin; spec should be updated to document it
- [x] SPEC.md §6 Pages is missing a `/profile` page section — the Profile page now exists and is the only way for a wrestler to set `weight_class` and update `name`; spec should document it alongside the other pages (tables used, fields, behavior)
- [x] SPEC.md §6 Matches says "FastAPI: None" but `Matches.jsx` now calls `POST /predict/match-outcome` — spec should be updated to reflect the new prediction integration
- [x] SPEC.md §6 Notes says "read last 10 for match selector dropdown" but the limit was intentionally removed for better UX — spec should reflect the current behavior (loads all matches)
- [x] `WeightLog.jsx` — cut predictor "TARGET CLASS" input has no `min`/`max` attributes; user can submit unrealistic values (e.g. 5000 lbs) while the weight input correctly constrains to 50–400 — should add matching constraints
- [x] `Matches.jsx` — match-outcome predictor form is always visible even when wrestler has fewer than 10 matches; the endpoint returns a cold-start 0.5 probability with low confidence, but the UI gives no indication that the prediction is unreliable — consider showing a hint or disabling the form below the threshold
- [x] **BLOCKER** — Supabase tables are missing columns that the frontend expects: `matches.tournament`, `notes.context` (and likely others) do not exist in the live database — errors visible in UI: "Could not find the 'tournament' column of 'matches' in the schema cache" and "Could not find the 'context' column of 'notes' in the schema cache". The tables were likely created with only a subset of the spec §4 columns. All five tables need to be verified against the spec and missing columns added via `ALTER TABLE` or a full recreate
- [x] Add `email` column to `wrestlers` table and separate it from `name` — currently sign-up stores the user's email as their `name`, so Profile shows the email in the NAME field. Changes needed: (1) add `email text` column to `wrestlers` in `sql/schema.sql`; (2) add `ALTER TABLE` to `sql/patch_missing_columns.sql` for live DB; (3) update `sql/create_wrestler_on_signup.sql` trigger to insert `email = new.email` and `name = null`; (4) update `Auth.jsx` insert to send both `email` and `name: null`; (5) update `Profile.jsx` to show email read-only and name as editable; (6) update `Dashboard.jsx` if it displays wrestler name; (7) update SPEC.md §4 `wrestlers` schema to include `email`; (8) backfill existing rows: `UPDATE wrestlers SET email = name, name = null WHERE email IS NULL`
 
---
 
- [x] **BLOCKER** — `pursuit/.env` has `VITE_API_URL=http://localhost:5173/auth` which points at the React frontend, not the FastAPI backend — all prediction calls (`/predict/weight-cut`, `/predict/weight-trend`, `/predict/match-outcome`, `/predict/performance-trend`) silently fail because they hit the wrong server. Should be `VITE_API_URL=http://localhost:8000`. FastAPI is confirmed running and healthy on port 8000
 
---
 
- [x] Add pagination + React Query to Notes, Schedule, Matches, WeightLog — `@tanstack/react-query` v5 with `QueryClientProvider` in `main.jsx`, paginated accumulate-and-append for Notes/Matches/Schedule, simple `useQuery` with `limit(30)` for WeightLog, `invalidateQueries` on all writes, `enabled: !!uid` pattern, load-more buttons

---

## New Features
- [x] Migration: add `time_of_day` text column (not nullable) to `weight_logs` table in Supabase with a check constraint: `time_of_day in ('morning', 'before_practice', 'after_practice', 'night')`
- [x] Frontend: enhance WeightLog.jsx with time-of-day dropdown, daily average chart, and custom hover tooltip (requires migration above to be done first)
- [x] Enhance weight logging with time-of-day context:
  - Add a `time_of_day` column (text, not nullable) to `weight_logs` table with allowed values: 'morning' | 'before_practice' | 'after_practice' | 'night'
  - Update the log weight form in `WeightLog.jsx` to include a dropdown for time of day (required field, no default so the wrestler has to consciously pick)
  - Allow multiple weight logs per day — no unique constraint on (wrestler_id, date)
  - Update the Recharts line chart to graph daily average weight (not individual entries) — recompute the average client-side whenever new data loads
  - Each data point on the chart represents one day. On hover, show a custom tooltip displaying every individual log for that day: weight value, time of day label, and optional note if present
  - Update `wrestlers.current_weight` on insert to always reflect the most recent individual log (not the daily average) — most recent by `logged_at` timestamp
  - Update the React Query cache invalidation on insert to refetch the weight log query so the chart recalculates immediately without a page refresh

### Infrastructure (do first — blocks social features)
- [x] Add `show_on_board` boolean column (default false) to `wrestlers` table — add to `sql/schema.sql` and `sql/patch_missing_columns.sql`. Add RLS policies: (1) any authenticated user can `SELECT` wrestlers where `show_on_board = true`; (2) any authenticated user can `SELECT` from `weight_logs`, `matches`, `schedules` where `wrestler_id` belongs to a wrestler with `show_on_board = true`. Required before `/board` and activity feed
- [x] Update `Profile.jsx` to include a `show_on_board` toggle (checkbox or switch) — reads and writes the new column alongside `name` and `weight_class`

### Progress Tracking
- [x] Build `/records` page — compute personal records client-side from matches: fastest pin, biggest point differential (parse `score` field e.g. `"8-2"` → 6), longest win streak (consecutive wins by `match_date`), best tournament placement. Add route to `App.jsx`, nav link to `Layout.jsx`. See SPEC.md §6 `/records` for full details
- [x] Build `/timeline` page — Recharts chart with weight as a line and match results as overlaid markers (green=win, red=loss, grey=draw) on a shared date axis. Pull from `weight_logs` and `matches`. Add route to `App.jsx`, nav link to `Layout.jsx`. See SPEC.md §6 `/timeline`
- [x] Add streak tracking to `Dashboard.jsx` — compute consecutive days with a weight log entry from `weight_logs` ordered by `logged_at`. Display as a stat box alongside current weight, weight class, etc.

### Social & Accountability (requires `show_on_board` column + RLS from above)
- [x] Build `/board` page — read all wrestlers where `show_on_board = true`, display name, current weight, weight class, lbs to cut. Sorted by weight class asc. Read-only. Add route to `App.jsx`, nav link to `Layout.jsx`. See SPEC.md §6 `/board`
- [x] Add teammate activity feed to `Dashboard.jsx` — show recent weight logs, match results, schedule events from the last 48 hours from wrestlers with `show_on_board = true`. Show wrestler name + action + timestamp. See SPEC.md §6 `/dashboard`

---

## Non-blocking Issues

- [x] `Dashboard.jsx` streak computation — `computeStreak` uses `cursor.toISOString().slice(0,10)` which converts to UTC; a wrestler logging at 11pm ET gets their log dated to the next UTC day, breaking streak continuity. Fix: use local date (`toLocaleDateString` or manual `getFullYear/getMonth/getDate`). Minor for ~50-user club app
- [x] `Dashboard.jsx` activity feed queries share a `try/catch` with the rest of `loadData` — if any feed query fails (e.g. RLS policy not yet applied for `show_on_board`), the entire Dashboard errors out. Feed queries should be wrapped in their own `try/catch` so the core dashboard still renders

- [x] `Records.jsx` — "FIRST / MOST RECENT PIN" card label is contradictory and the logic just returns `pins[0]` from a descending-date query, which is the most recent pin — the label should say "MOST RECENT PIN" or the logic should sort ascending to show the first pin chronologically; pick one and make them match
- [x] `Records.jsx` — "FASTEST PIN" per SPEC.md §6 should be the fastest pin, but match duration isn't stored; the card currently shows most recent pin as a placeholder — either rename in the spec to "MOST RECENT PIN" or add a comment that duration data is unavailable and this is a proxy
- [x] `Records.jsx` — score parsing assumes exact `"A-B"` format (`score.split('-')`); scores with whitespace like `"8 - 2"` or trailing text like `"8-2 OT"` are silently skipped — should trim parts and handle common variations
- [x] `Dashboard.jsx` — activity feed sorts items by `b.ts.localeCompare(a.ts)` but match feed items use `m.match_date` as their `ts` (a `date` like `"2026-04-04"`) while weight/schedule items use full ISO timestamps — `localeCompare` still works for ordering but mixing date-only and datetime strings may produce incorrect interleaving within the same day

- [x] `Auth.jsx` — when a user tries to sign up with an email that already exists, Supabase returns a fake success (no error, but `data.user.identities` is an empty array) to prevent email enumeration. The current code falls through to the `wrestlers.insert` which silently fails or creates a confusing state. Detect the empty-identities case after `signUp` and show a clear message like "An account with this email already exists. Try signing in instead."
- [x] `Auth.jsx` — add a "Forgot password?" link below the sign-in form that calls `supabase.auth.resetPasswordForEmail(email)` and shows a confirmation message ("Check your email for a reset link"). Also add a `/reset-password` page (or handle via Supabase's built-in redirect) that calls `supabase.auth.updateUser({ password })` when the user clicks the emailed link — needs a route in `App.jsx`, and SPEC.md §6 and §7 should document the flow

## Workout & Goals — fixes before building

- [x] Migration: create Postgres RPC function `insert_lifting_workout` 
      that inserts into `workouts` and `workout_exercises` in a single 
      transaction. The React frontend calls `supabase.rpc('insert_lifting_workout', 
      {...})` instead of two separate inserts. This prevents orphaned 
      workout rows if the exercises insert fails.

- [x] Migration: add `completed` (boolean, default false) and 
      `completed_at` (timestamptz, nullable) columns to `goals` table. 
      Auto-tracked goals: when progress computation hits 100%, 
      automatically set completed=true and completed_at=now() on the 
      next render. Manual/other goals: wrestler taps a "Mark complete" 
      button. Past goals section filters on target_date < now() OR 
      completed=true, and shows a "succeeded" vs "failed" badge based 
      on completed flag.

- [x] Migration: add `goal_type` check constraint on goals table 
      enforcing that lifting/practice/habit goals always have 
      tracking_type='auto', and 'other' always has 
      tracking_type='manual'. Add check constraint on progress column: 
      progress >= 0 AND progress <= 100.

- [x] Migration: normalize tournament names. Add a `tournaments` table 
      (id, name, date, wrestler_id) and replace the free text 
      `tournament` field in both `matches` and `goals` with a FK → 
      tournaments.id. Frontend shows a dropdown of past tournaments 
      when logging a match or creating a tournament_placement goal, 
      with an "Add new" option.

- [x] Frontend: all "this week" computations (lifting goals, practice 
      goals, habit logs) must use the user's local timezone, not UTC. 
      Use date-fns `startOfWeek` and `endOfWeek` with the user's 
      timezone offset for all week boundary calculations. Week starts 
      Monday. Pass these as ISO strings to Supabase queries using 
      `.gte('created_at', weekStart).lte('created_at', weekEnd)`.

- [x] Frontend: when a workout is successfully inserted on `/workouts`, 
      call `queryClient.invalidateQueries(['goals', user.id])` in 
      addition to `['workouts', user.id]` so goal progress updates 
      immediately without a stale cache.

- [x] Frontend: habit goals need an explicit log button on the goal 
      card — a "Log today" button that inserts a row into `habit_logs`. 
      Disable it if the wrestler has already logged for today 
      (check habit_logs for an entry where logged_at >= start of 
      today in local timezone). Show a count of logs this week vs 
      target on the card.

- [x] Frontend: add edit and delete for both workouts and goals. 
      Workout list: delete button on each row (with confirmation). 
      Lifting workouts: edit re-opens the table form pre-filled. 
      Goals: delete button on each card (with confirmation). No edit 
      on goals — delete and recreate is simpler and less error-prone.

- [x] Frontend: when a lifting workout row is expanded, fetch 
      `workout_exercises` on demand using a separate React Query call 
      with queryKey: ['workout_exercises', workout.id]. Do not 
      eagerly join in the list query — 15 workouts × N exercises 
      is too heavy for the list view.

- [x] Note: `workout_exercises.wrestler_id` is intentionally redundant 
      with `workouts.wrestler_id` for RLS purposes. On the RPC 
      function, always set both from auth.uid() to keep them in sync. 
      Never trust the client to pass wrestler_id — always derive it 
      server-side in the RPC function.

_Last updated by: Reviewer — 2026-04-05 (workout & goals approved, 118 tests across 15 files)_
 