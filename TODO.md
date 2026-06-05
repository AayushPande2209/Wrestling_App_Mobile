# Pursuit Wrestling App — Todo List
 
## How this works
- **Planner** finds issues and adds them here
- **Builder** picks the next unchecked item and implements it
- **Reviewer** checks the work, writes tests, then marks it done
- One item at a time. Builder does not move on until Reviewer marks it complete.
 
---
- [x] Onboarding: when a wrestler signs up, after successful auth 
      redirect to a new `/profile/setup` page instead of `/dashboard`. 
      This page is only shown once — if the wrestler already has a 
      name set (not equal to their email), redirect to /dashboard.
      
      `/profile/setup` page:
      - Heading: "Set up your profile"
      - Name input (text, required, placeholder "Your name") 
      - Weight class input (number, optional, can skip and set later)
      - Submit button: "Get started"
      - On submit: update wrestlers table row where id = auth.uid() 
        setting name = entered name, weight_class = entered value if 
        provided
      - On success: redirect to /dashboard
      - Skip link below the form: "Skip for now" → redirects to 
        /dashboard without updating name

      Migration: add `email` (text, nullable) column to `wrestlers` 
      table. On sign up, insert wrestler row with 
      id = auth.uid(), name = email (temporary default), 
      email = email. Email should never be editable from the 
      frontend — it is set once on sign up and never changed. 
      RLS: wrestler can read their own email, cannot update it.

      After profile setup is complete, display the wrestler's name 
      (not email) everywhere in the app — sidebar, dashboard 
      greeting, activity feed. Wherever name = email is currently 
      shown as a fallback, replace with 'Wrestler' as the fallback 
      instead so emails are never exposed in the UI.


## Deployment Blockers

- [x] **BLOCKER** — Fly.io missing `FRONTEND_URL` secret. CORS config 
      in `main.py` only allows `http://localhost:5173` plus 
      `FRONTEND_URL`. Without it, all production FastAPI requests from 
      Vercel are blocked by CORS preflight (`net::ERR_FAILED`). Every 
      prediction endpoint (weight-cut, weight-trend, match-outcome, 
      performance-trend, meal-plan, recovery-protocol) silently fails 
      in production. Fix: `fly secrets set FRONTEND_URL=https://wrestling-app-two.vercel.app`
      (use the stable Vercel domain, not the per-deploy preview URL).
      Then redeploy: `fly deploy` from `wrestling-api/`.

- [x] **BLOCKER** — Fly.io needs redeployment to pick up ES256 auth 
      fix. The deployed code still uses HS256-only JWT validation 
      (`auth.py` before the JWKS fix), which rejects every real 
      Supabase user token with 401. Local code is fixed 
      (JWKS + ES256), but `fly deploy` has not been run since.

---

## Spec Drift

- [x] SPEC.md §4 `weight_logs` table is missing the `time_of_day` 
      column. Schema.sql and the code both have it as `text NOT NULL` 
      with check constraint `('morning', 'before_practice', 
      'after_practice', 'night')`. Add to the spec table.

- [x] SPEC.md §4 `workouts` table is missing `workout_type` and 
      `duration_minutes` columns. Schema.sql has 
      `workout_type text NOT NULL default 'lifting'` with check 
      constraint `('lifting', 'practice', 'cardio', 'other')` and 
      `duration_minutes int`. The frontend uses both. Add to the 
      spec table.

- [x] SPEC.md §3 architecture diagram lists only 4 FastAPI endpoints 
      but there are now 6: `POST /predict/meal-plan` and 
      `POST /predict/recovery-protocol` are missing from the diagram.

- [x] SPEC.md §3 key rule says "All FastAPI endpoints validate the 
      Supabase JWT (`HS256`, audience `authenticated`)" and §7 repeats 
      this. The code now uses JWKS-based validation with 
      `algorithms=["ES256", "HS256"]` fetching the public key from 
      Supabase's `/.well-known/jwks.json`. Both references need 
      updating.

- [x] SPEC.md §6 `/records`, `/timeline`, and `/board` pages still 
      say `Status: Planned` but all three are built and checked off.
      Change to `Status: Built`.

- [x] SPEC.md §6 `/workouts` page section doesn't mention workout 
      type selector (lifting/practice/cardio/other) or duration 
      field. The current UI shows a type picker before the form, 
      and practice/cardio/other types have a duration input instead 
      of exercise rows.

- [x] SPEC.md §6 `/auth` says sign-up inserts `name = null` and 
      redirects to `/dashboard`. Updated to `name = email` 
      (temporary default) and redirect to `/profile/setup`.

- [x] SPEC.md §6 missing `/profile/setup` onboarding page section. 
      Added with full description of one-time flow, email privacy 
      safeName pattern, and skip behavior.

- [x] SPEC.md §7 protected routes missing `/profile/setup`. Added 
      with note that it uses ProtectedRoute but not Layout.

---

## Non-blocking Issues

- [x] Add error boundary in React — wrap the app so a crash on 
      one page doesn't blank the entire app. Show a simple 
      "Something went wrong" message with a refresh button instead.

- [ ] `Records.jsx` uses legacy `tournament` text field in its query 
      instead of `tournament_id` FK + `tournaments(name)` join. 
      Matches.jsx already uses the FK pattern. Records should match: 
      `.select('*, tournaments(name)')` and display 
      `r.tournaments?.name` instead of `r.tournament`.

- [ ] `sql/patch_missing_columns.sql` RPC `insert_lifting_workout` 
      omits explicit `workout_type = 'lifting'` column assignment 
      in the INSERT — it relies on the table default. The canonical 
      `sql/schema.sql` version includes it explicitly. Add 
      `workout_type = 'lifting'` to the patch RPC for consistency.

- [ ] Auth sign-up flow does not tell the user to confirm their 
      email. After `supabase.auth.signUp`, the code immediately 
      navigates to `/profile/setup` (Auth.jsx:36). If Supabase 
      email confirmation is enabled (default), the session won't 
      be valid until the user clicks the confirmation link — so 
      `/profile/setup` will fail or redirect back to login.
      
      Fix: after successful sign-up, show a confirmation message 
      ("Check your email to confirm your account") instead of 
      navigating away. Similar to the forgot-password `forgotSent` 
      pattern already in Auth.jsx. Navigation to `/profile/setup` 
      should happen after the user confirms and signs in for the 
      first time.

---

## UX Improvements (Wrestler Feedback)

_Findings from a full UX audit roleplaying a 16-year-old high school 
wrestler at Pursuit Wrestling Club. Ordered by impact._

### High Priority — Daily Use Pain Points

- [ ] **Dashboard: make "TO CUT" the hero number.** Currently it's 
      the same size as every other StatBox in a 5-col grid. On 
      mobile (2-col) it's buried in the third row. Change: make 
      "TO CUT" a full-width banner at the top of the dashboard 
      with a large font (text-5xl+), showing the number in amber 
      when cutting, green "ON WEIGHT" when at/below class. Move 
      the other 4 stats (current weight, weight class, record, 
      streak) into a smaller row below it.

- [ ] **Dashboard: move quick actions above the fold.** LOG WEIGHT, 
      ADD MATCH, ADD NOTE buttons are at the very bottom of the 
      page. On mobile you have to scroll past stats, performance 
      trend, cut analysis, next event, and activity feed to reach 
      them. Move them immediately below the hero stat row, before 
      any prediction cards.

- [ ] **Weight log: default time-of-day to "morning."** The 
      time_of_day select has no default (`value=""`) so it's a 
      required tap every single log. Most wrestlers weigh first 
      thing in the morning. Default to `'morning'` in the 
      `useState` initializer. User can still change it.

- [ ] **Weight log: pre-fill cut predictor from profile.** The cut 
      predictor form on the weight log page asks for "TARGET 
      CLASS" every time, but this is already stored in 
      `wrestlers.weight_class`. Pre-fill `cutTarget` from the 
      wrestler's profile data (fetch alongside logs). User can 
      override.

- [ ] **Matches: persist tournament + date across sequential adds.** 
      After a tournament day (3-2 = 5 matches), the form resets 
      tournament and date on each submit. After submit, keep 
      `tournamentId` and `matchDate` at their current values so 
      the wrestler only needs to enter opponent, result, and score 
      for the next match. Add a visible "RESET FORM" link to 
      clear all fields when done.

- [ ] **Weight class: use a standard dropdown instead of free-form 
      number input.** Wrestling has fixed weight classes. Replace 
      the `<input type="number">` for weight class with a 
      `<select>` dropdown in three locations: ProfileSetup.jsx, 
      Profile.jsx, and the cut predictor on WeightLog.jsx. High 
      school classes: 106, 113, 120, 126, 132, 138, 144, 150, 
      157, 165, 175, 190, 215, 285. Include an "Other" option 
      that reveals a number input for non-standard classes 
      (youth, college, freestyle).

### Medium Priority — Weekly Use Improvements

- [ ] **Matches: add edit and delete.** Currently matches cannot be 
      modified after creation. Add an edit button on each match 
      row (re-opens form pre-filled, like workouts) and a delete 
      button with confirmation modal (same pattern as 
      Workouts.jsx `pendingDelete`).

- [ ] **Nutrition: swap section order — recovery first, meal plan 
      second.** Recovery protocol is the killer feature for 
      wrestlers (step-by-step rehydration plan after weigh-ins). 
      It's currently buried below the meal planner. Move "POST 
      WEIGH-IN RECOVERY" above "CUT MEAL PLANNER" so it's the 
      first thing a wrestler sees.

- [ ] **Dashboard: add empty state guidance for new users.** When a 
      wrestler first signs up, the dashboard shows dashes for 
      every stat and "No upcoming events." Add contextual prompts: 
      - If no weight logs: "Log your first weight to start 
        tracking your cut" with a link to /weight
      - If no matches: "Add a match to build your record" with 
        a link to /matches
      - If no weight_class set: "Set your weight class in Profile 
        to enable cut analysis" with a link to /profile

- [ ] **Notes: add search.** Notes page has no way to find old 
      notes. Add a text input at the top of the notes list that 
      client-side filters `allNotes` by substring match on 
      `note.body` (case-insensitive). No backend changes needed.

- [ ] **Sidebar: group navigation items.** 12 flat nav links is 
      overwhelming. Group into sections with subtle headers: 
      DAILY (Dashboard, Weight, Workouts), COMPETE (Matches, 
      Records, Timeline), PLAN (Goals, Schedule, Nutrition, 
      Notes), TEAM (Board), and ACCOUNT (Profile) at the bottom. 
      Headers are non-clickable `text-[9px] text-[#333]` labels.

- [ ] **Goals: make progress bar more visible.** Current bar is 
      `h-1` (4px). Increase to `h-2` (8px) and add a percentage 
      label inside the bar when width >= 20%. This makes progress 
      feel tangible instead of invisible.

### Lower Priority — Polish

- [ ] **Auth: add a tagline explaining what the app does.** Below 
      "WRESTLER TRAINING SYSTEM" on the auth page, add a one-line 
      value prop: "Track your weight, matches, and training — get 
      AI-powered cut plans and recovery protocols." A wrestler 
      should know what they're signing up for.

- [ ] **Records: fix career summary grid on mobile.** The career 
      summary section uses `grid-cols-4` unconditionally. On a 
      phone, 4 columns of 2xl numbers are cramped and may 
      overflow. Change to `grid-cols-2 md:grid-cols-4` so mobile 
      gets 2 rows of 2 columns.

- [ ] **Match list: responsive layout on mobile.** The match list 
      uses `min-w-[520px]` forcing horizontal scroll on phones. 
      Replace the 5-column grid with a stacked card layout on 
      mobile (`md:grid grid-cols-1 md:grid-cols-5`) where each 
      match shows as: opponent name (large), result + win type 
      badge, score, tournament, and date in a compact vertical 
      stack.

- [ ] **Dashboard: link "No upcoming events" to /schedule.** 
      Currently it's a dead-end paragraph. Change to a clickable 
      link: "No upcoming events — add one" that navigates to 
      /schedule.

- [ ] **Workouts: "copy last workout" for lifting.** After logging 
      the same lifting routine repeatedly, filling in 6+ exercise 
      rows from scratch is tedious. Add a "COPY LAST" button 
      next to "LOG WORKOUT" that pre-fills the exercise rows from 
      the most recent lifting workout. Fetch the latest lifting 
      workout's exercises and populate the `rows` state.

_Last updated by: Planner — 2026-04-09 (UX audit, 16 new items)_
