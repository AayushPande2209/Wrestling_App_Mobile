# Pursuit Mobile — App Specification

> Mobile spec for the Pursuit wrestling app (iOS). Read alongside SPEC.md (web). The backend, database, and all API contracts are shared — this spec covers mobile-only architecture, navigation, screens, and UI.

---

## 1. Overview

**Platform:** iOS only (iPhone). No Android for MVP.
**Framework:** Expo (React Native) with Expo Router for navigation.
**Distribution:** TestFlight for internal testing → App Store.
**Backend:** Shared with web — same Supabase database, same FastAPI endpoints on Fly.io.
**Key additions over web:** AI weight cut coach agent, push notifications, scale photo scanning (post-MVP).

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo (managed workflow) |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind + StyleSheet |
| Auth storage | `expo-secure-store` + `@react-native-async-storage/async-storage` |
| Charts | `react-native-svg` (custom SVG charts) |
| Animations | `react-native-reanimated` |
| Gestures | `react-native-gesture-handler` |
| Bottom sheets | `@gorhom/bottom-sheet` |
| Icons | `@expo/vector-icons` (Ionicons) |
| Push notifications | `expo-notifications` |
| Safe area | `react-native-safe-area-context` |
| Database | Supabase JS SDK (same as web, AsyncStorage adapter) |
| ML/predictions | FastAPI (same endpoints as web) |

**Env vars (`.env` in `pursuit-mobile/`):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL`

---

## 3. Design Tokens

```js
const colors = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#222222',
  borderAccent: '#2a1a06',
  orange: '#e8712a',
  orangeDim: '#1e1208',
  orangeBorder: '#3a2010',
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#555555',
  textFaint: '#333333',
  green: '#4ade80',
  greenDim: '#1a2a1a',
  red: '#e24a4a',
}
```

**Typography:**
- Numbers and stat labels: `JetBrains Mono` (loaded via `expo-font`)
- Body and UI text: system font (SF Pro on iOS)
- All labels: uppercase, `letterSpacing: 1.5`

**Borders:** `0.5px` everywhere — no shadows, no elevation.
**Press states:** `activeOpacity={0.7}` on all `TouchableOpacity` elements.
**Safe area:** `useSafeAreaInsets` on every screen — pad top for status bar, bottom for home indicator.
**StatusBar:** `light-content` on all screens.

---

## 4. File Structure

```
pursuit-mobile/
  app/
    _layout.jsx               ← root layout, auth listener
    (auth)/
      index.jsx               ← sign in / sign up
      reset-password.jsx
    (app)/
      _layout.jsx             ← tab bar layout
      index.jsx               ← dashboard
      weight.jsx              ← weight log
      coach.jsx               ← AI coach chat
      activity.jsx            ← activity hub (modal)
      other.jsx               ← other sidebar
      matches.jsx
      workouts.jsx
      goals.jsx
      nutrition.jsx
      notes.jsx
      records.jsx
      timeline.jsx
      board.jsx
      profile.jsx
      schedule.jsx
  lib/
    supabase.js               ← Supabase client (AsyncStorage adapter)
    api.js                    ← FastAPI fetch helpers
  components/
    CutWidget.jsx             ← persistent cut stat (used in sidebar + dashboard)
    ProtectedRoute.jsx
    StatCard.jsx
    WeightChart.jsx           ← SVG sparkline
  constants/
    colors.js
    fonts.js
```

---

## 5. Navigation

### Bottom Tab Bar
Persistent on all `(app)` screens. 5 tabs:

| Tab | Icon | Behavior |
|-----|------|----------|
| HOME | `grid-outline` | Navigate to Dashboard |
| COACH | `hardware-chip-outline` | Navigate to Coach chat |
| WEIGHT | `scale-outline` | Navigate to Weight Log |
| ACTIVITY | `barbell-outline` | Open Activity modal sheet |
| OTHER | `menu-outline` | Open Other sidebar (slide from right) |

Active tint: `#e8712a`. Inactive: `#3a3a3a`. Background: `#0a0a0a`. Top border: `#1a1a1a`. Labels: 9px monospace uppercase.

### Other Sidebar
Slides in from the right using `react-native-reanimated`. Left portion dimmed with `rgba(0,0,0,0.55)` overlay — tapping the dim area closes. Width: 72% of screen.

Contains: PROFILE, BOARD, SCHEDULE, divider, NOTES, TIMELINE, RECORDS, divider, SIGN OUT (red).

Cut widget shown at the top of the sidebar — always visible regardless of current screen.

### Activity Modal
Opens as a bottom sheet (`@gorhom/bottom-sheet`) when ACTIVITY tab is tapped. Contains 4 card buttons navigating to WORKOUTS, MATCHES, GOALS, NUTRITION.

---

## 6. Screens

### Dashboard (`app/(app)/index.jsx`)
**Tables:** `wrestlers`, `weight_logs`, `matches`, `schedules`
**FastAPI:** `GET /predict/performance-trend` (silent fail)

**Layout (top to bottom):**

Header: "PURSUIT" logo orange left, wrestler name muted below, bell icon right.

Hero cut card (`#141414`, `#2a1a06` border):
- SVG sparkline chart overlay (bottom of card) — last 7 weight logs, orange line + subtle fill, `opacity: 0.5`
- "TO CUT" label → lbs to cut in `28px` bold orange monospace
- "LBS TO X CLASS" subtitle
- Progress bar: track `#1e1e1e`, fill orange, capped 0–100%
- Bar labels: class weight / current weight / +5
- "LOG WEIGHT" button → navigates to Weight tab

2×2 stat grid:
- RECORD (W–L)
- STREAK (orange if > 0)
- WIN RATE
- WEIGH-IN (days until next schedule event, from `schedules` table)

Performance trend card: title orange, overall win rate, trend badge (green/amber/red).

**If `weight_class` not set:** show prompt card "Set your weight class in Profile to see your cut."
**If FastAPI unreachable:** hide performance trend card silently.

---

### Weight Log (`app/(app)/weight.jsx`)
**Tables:** `weight_logs` (read last 30, insert), `wrestlers` (update `current_weight`)
**FastAPI:** None on this screen (predictions accessible via Coach)

Header: back chevron + "LOG WEIGHT" + current date (MON · JUN 6).

Weight input: tappable number `32px` bold orange monospace with orange bottom border. Tapping opens numeric keyboard. "LBS" unit inline.

Time of day: 2×2 button grid — MORNING, BEFORE PRACTICE, AFTER PRACTICE, NIGHT.
Active: `#1e1208` bg + orange border + orange text. Inactive: `#141414` + `#222` border + `#555` text.

Optional note: `TextInput`, `#141414` bg, 9px monospace placeholder.

"LOG WEIGHT" button: full-width orange, radius 6. On submit: inserts into `weight_logs`, updates `wrestlers.current_weight`, invalidates dashboard query cache.

Recent logs list: date / weight (bold) / time-of-day. Rows separated by `#1a1a1a`.

---

### Coach (`app/(app)/coach.jsx`)
**Tables:** `wrestlers`, `weight_logs`, `matches`, `workouts`, `schedules`, `coach_messages`
**FastAPI:** `POST /coach/chat`

**Two states:**

**Onboarding** (if `wrestlers.coach_profile` is null):
Conversational one-question-at-a-time flow. Questions displayed as agent messages, wrestler answers via text input or quick-reply buttons where applicable.

Questions:
1. What weight class are you cutting to this season?
2. When do you typically start your cut? (e.g. 3 days out, 1 week out)
3. How much do you usually cut the day of weigh-ins?
4. How do you cut? (diet only / sweat / water restriction / combination — quick reply buttons)
5. What's usually available at your school lunch?
6. Anything else your coach should know? (skippable)

On completion: POST to `/coach/chat` with onboarding payload, save `coach_profile`, transition to chat.

**Chat state:**
Context bar below header: CURRENT WEIGHT · LBS TO CUT · DAYS OUT — pulled from `wrestlers` + `schedules`.

Phase badge: "LEAD-UP PHASE — DIET CUT" or "SAME-DAY CUT" or "MAINTENANCE MODE" depending on days out + cut amount remaining. Shown below context bar.

Chat bubbles:
- Assistant: `#141414` bg, `#1f1f1f` border, `#cccccc` text, bottom-left radius 2px
- User: `#1e1208` bg, `#2a1a08` border, orange text, bottom-right radius 2px

Full chat history loaded on mount from `coach_messages` ordered by `created_at` asc. Last 40 messages sent in context to FastAPI each call.

Input row: text input + orange send button (circle, arrow-up icon). Send on tap or keyboard submit.

Loading state: typing indicator (3 dots) while awaiting FastAPI response.

**Push notification triggers (via `expo-notifications`):**
- Every morning at 7am: daily weight cut breakdown
- Every 2–3 hours during the day (if weigh-in within 7 days): check-in prompt
- If no weight log in 24 hours: reminder to log
- Night before weigh-in: same-day cut plan
- Post weigh-in (detected by weight drop below class): rehydration protocol prompt

Notifications are scheduled locally via `expo-notifications` based on wrestler's schedule data and logging patterns. No external notification server needed for MVP.

---

### Activity Modal (`app/(app)/activity.jsx`)
**Tables:** `workouts`, `matches`, `goals`, (nutrition uses FastAPI)

Opens as bottom sheet. Header: back chevron + "ACTIVITY".

4 horizontal cards in a single `flexDirection: 'row'` row:
Each card: `flex: 1`, `#141414` bg, `#252525` border, radius 8, centered column.
- Icon: 22px orange Ionicons
- Label: 9px muted monospace uppercase

| Card | Icon | Navigates to |
|------|------|-------------|
| WORKOUTS | `barbell-outline` | `/workouts` |
| MATCHES | `shield-outline` | `/matches` |
| GOALS | `trophy-outline` | `/goals` |
| NUTRITION | `nutrition-outline` | `/nutrition` |

Recent activity feed below cards: last 5 items across workouts + matches + goals combined. Each row: name left + date right, 10px monospace. Sorted by date descending.

---

### Other Sidebar (`app/(app)/other.jsx`)
Slide-in drawer from right, `react-native-reanimated`. 72% screen width. Left dim overlay closes on tap.

Top: PURSUIT logo + TRAINING SYSTEM subtitle.

Cut widget: `#0a0a0a` bg, orange accent border, radius 6. Shows lbs to cut + current → class.

Nav items (icon + label, 11px monospace):

**Section 1:**
- PROFILE (`person-circle-outline`) → `/profile`
- BOARD (`people-outline`) → `/board`
- SCHEDULE (`calendar-outline`) → `/schedule`

**Section 2 (divider):**
- NOTES (`document-text-outline`) → `/notes`
- TIMELINE (`trending-up-outline`) → `/timeline`
- RECORDS (`trophy-outline`) → `/records`

**Section 3 (divider):**
- SIGN OUT (`log-out-outline`) — color `#e24a4a` — calls `supabase.auth.signOut()`, navigates to `/(auth)/`

Active item: `#1a1208` bg + orange text. Inactive: `#555` text.

---

### Matches (`app/(app)/matches.jsx`)
Same data logic as web. Mobile layout: W–L record at top, add match form as a card, match list below.
Match outcome predictor accessible via a "PREDICT" button that opens a bottom sheet.

---

### Workouts (`app/(app)/workouts.jsx`)
Same data logic as web. Workout type selector as horizontal button group. Lifting form uses a dynamic table rendered as rows of `TextInput` components. Add/remove row buttons.

---

### Goals (`app/(app)/goals.jsx`)
Same data logic as web. Goals as cards with progress bars. Active goals on top, completed/expired collapsed below. "Log today" button on habit goals.

---

### Nutrition (`app/(app)/nutrition.jsx`)
Two sections: Cut Meal Planner + Post Weigh-In Recovery. Both call FastAPI. Recovery section shown first (per UX audit — higher value feature). Fails silently with inline message.

---

### Notes (`app/(app)/notes.jsx`)
Add note form at top. Context filter as horizontal chip row. Notes list ordered by `created_at` desc.

---

### Records (`app/(app)/records.jsx`)
Read-only. Computed client-side from `matches`. Cards for: longest win streak, biggest point differential, most recent pin, best tournament placement.

---

### Timeline (`app/(app)/timeline.jsx`)
SVG chart (via `react-native-svg`) — weight line + match result markers (green/red/grey dots). X-axis dates, Y-axis weight. Scrollable horizontally.

---

### Board (`app/(app)/board.jsx`)
Read-only. List of opted-in wrestlers sorted by weight class. Each row: name + current weight + weight class + lbs to cut.

---

### Profile (`app/(app)/profile.jsx`)
Editable: name, weight class (dropdown of standard HS classes), show_on_board toggle. Email shown read-only. Changes saved to `wrestlers` table.

---

### Schedule (`app/(app)/schedule.jsx`)
Add event form + upcoming/past event list. Upcoming at full opacity, past at 35% opacity.

---

### Auth (`app/(auth)/index.jsx`)
Sign in / sign up toggle. Email + password. Duplicate email detection (empty `identities` array). On sign up → insert `wrestlers` row → navigate to onboarding if `name = email`.

---

### Reset Password (`app/(auth)/reset-password.jsx`)
Public route. Listens for `PASSWORD_RECOVERY` event via `onAuthStateChange`. Shows new password form once temporary session is live.

---

## 7. Coach Agent

### Architecture
```
app (React Native)
    │
    └── POST /coach/chat (Bearer token) ──► FastAPI
                                               │
                                               ├── reads: wrestlers, weight_logs,
                                               │   matches, workouts, schedules,
                                               │   coach_messages
                                               │
                                               └── calls Claude claude-sonnet-4-20250514
                                                   with assembled context
```

### Database additions
```sql
-- Add to wrestlers table
alter table wrestlers add column coach_profile jsonb default null;

-- New table
create table coach_messages (
  id uuid primary key default gen_random_uuid(),
  wrestler_id uuid references wrestlers(id) not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
```
RLS on `coach_messages`: wrestlers can only select/insert their own rows.

### Context injected per call
- Wrestler profile: name, current weight, weight class, coach_profile
- Last 30 weight logs with time of day
- Last 7 days of workouts
- Last 20 matches ordered by match_date
- Next upcoming schedule event
- Last 40 coach_messages (chat history)

### Two-phase cut model
The agent distinguishes between:
1. **Lead-up phase** (days 1 to N-1): diet-based, 0.3–0.5 lbs/day, sodium restriction, carb management
2. **Same-day water cut** (day of weigh-in): 2–5 lbs normal, via sweat/water restriction — do NOT flag as dangerous unless exceeding safe threshold

Phase is determined from days until next weigh-in + current lbs to cut.

### Food recommendations
Specific ingredients and recipes — not generic advice. Accounts for school lunch options from onboarding. Structured by phase:
- Lead-up: high protein, moderate carbs, low sodium, adequate hydration
- Day before: low fiber, low sodium, controlled portions
- Day of: nothing that causes bloating, minimal water until after weigh-in
- Post weigh-in: immediate sodium + carbs + fluids, full meal 2 hours before first match

### Morning breakdown format
When wrestler opens app or receives morning notification, agent sends:
- Target weight tonight
- What to eat at each meal (specific)
- Water intake target
- What to avoid today
- One focus point

### Safety guardrails (hard rules)
- Never recommend cutting more than 3% body weight per day via dehydration
- If 3+ consecutive days of rapid drops in logs: flag, recommend talking to coach
- Never recommend diuretics, laxatives, or under 1200 calories
- If cut is mathematically impossible without serious risk: say so, suggest moving up a class
- Always defer to coach/athletic trainer for anything at the edge
- Disclaimer shown on Coach page: "This is not medical advice. Consult your coach and athletic trainer."

### Maintenance mode
If wrestler is at or below weight class: shift to competition prep — how to feel sharp, performance nutrition, pre-match meal timing.

### Post weigh-in recovery
Triggered by weight drop to/below class detected in logs. Agent proactively sends rehydration protocol:
- Fluids in oz = (weight before − weight after) × 16
- Sodium target: 1500–2000mg
- Timeline: immediate drink → recovery meal → light pre-match snack
- Specific food/drink recommendations

---

## 8. Push Notifications

Implemented via `expo-notifications` + APNs. Scheduled locally — no external notification server for MVP.

| Trigger | Timing | Content |
|---------|--------|---------|
| Morning breakdown | 7:00am daily (if weigh-in within 14 days) | Daily cut plan |
| Check-in | Every 3 hours (if weigh-in within 7 days) | Quick status check |
| No weight log | 24 hours after last log | Reminder to log |
| Night before weigh-in | 8:00pm | Same-day cut plan |
| Post weigh-in | Detected from weight drop | Rehydration protocol |

Notifications are scheduled/cancelled based on `schedules` table data. When wrestler adds a new schedule event, notification schedule is recalculated.

Permission requested on first launch of Coach screen.

---

## 9. Auth

Identical to web auth flow. Key mobile differences:
- Session stored in `AsyncStorage` via Supabase client config
- `detectSessionInUrl: false` (no URL hash on mobile)
- Deep link for password reset: configure `expo-linking` scheme `pursuit://reset-password`
- `ProtectedRoute` component checks session on mount, redirects to `/(auth)/` on expiry

---

## 10. Out of Scope for Mobile MVP

- Android support
- Scale photo scanning (camera → weight auto-fill) — post-MVP
- Video upload or match film
- Coach/admin view
- External tournament data import
- Trackwrestling integration
- Apple Watch companion app
- Offline mode / local data sync