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

_Last updated by: Planner — 2026-04-08 (added email confirmation item)_
