# Pursuit Wrestling App — Todo List
 
## How this works
- **Planner** finds issues and adds them here
- **Builder** picks the next unchecked item and implements it
- **Reviewer** checks the work, writes tests, then marks it done
- One item at a time. Builder does not move on until Reviewer marks it complete.
 
---

## Deployment Blockers

- [ ] **BLOCKER** — Fly.io missing `FRONTEND_URL` secret. CORS config 
      in `main.py` only allows `http://localhost:5173` plus 
      `FRONTEND_URL`. Without it, all production FastAPI requests from 
      Vercel are blocked by CORS preflight (`net::ERR_FAILED`). Every 
      prediction endpoint (weight-cut, weight-trend, match-outcome, 
      performance-trend, meal-plan, recovery-protocol) silently fails 
      in production. Fix: `fly secrets set FRONTEND_URL=https://wrestling-app-two.vercel.app`
      (use the stable Vercel domain, not the per-deploy preview URL).
      Then redeploy: `fly deploy` from `wrestling-api/`.

- [ ] **BLOCKER** — Fly.io needs redeployment to pick up ES256 auth 
      fix. The deployed code still uses HS256-only JWT validation 
      (`auth.py` before the JWKS fix), which rejects every real 
      Supabase user token with 401. Local code is fixed 
      (JWKS + ES256), but `fly deploy` has not been run since.

---

## Spec Drift

- [ ] SPEC.md §4 `weight_logs` table is missing the `time_of_day` 
      column. Schema.sql and the code both have it as `text NOT NULL` 
      with check constraint `('morning', 'before_practice', 
      'after_practice', 'night')`. Add to the spec table.

- [ ] SPEC.md §4 `workouts` table is missing `workout_type` and 
      `duration_minutes` columns. Schema.sql has 
      `workout_type text NOT NULL default 'lifting'` with check 
      constraint `('lifting', 'practice', 'cardio', 'other')` and 
      `duration_minutes int`. The frontend uses both. Add to the 
      spec table.

- [ ] SPEC.md §3 architecture diagram lists only 4 FastAPI endpoints 
      but there are now 6: `POST /predict/meal-plan` and 
      `POST /predict/recovery-protocol` are missing from the diagram.

- [ ] SPEC.md §3 key rule says "All FastAPI endpoints validate the 
      Supabase JWT (`HS256`, audience `authenticated`)" and §7 repeats 
      this. The code now uses JWKS-based validation with 
      `algorithms=["ES256", "HS256"]` fetching the public key from 
      Supabase's `/.well-known/jwks.json`. Both references need 
      updating.

- [ ] SPEC.md §6 `/records`, `/timeline`, and `/board` pages still 
      say `Status: Planned` but all three are built and checked off.
      Change to `Status: Built`.

- [ ] SPEC.md §6 `/workouts` page section doesn't mention workout 
      type selector (lifting/practice/cardio/other) or duration 
      field. The current UI shows a type picker before the form, 
      and practice/cardio/other types have a duration input instead 
      of exercise rows.

---

## Non-blocking Issues

- [ ] Add error boundary in React — wrap the app so a crash on 
      one page doesn't blank the entire app. Show a simple 
      "Something went wrong" message with a refresh button instead.

_Last updated by: Planner — 2026-04-07 (full sweep)_
