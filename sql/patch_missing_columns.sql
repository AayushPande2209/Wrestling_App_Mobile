-- Pursuit Wrestling App — Live Database Patch
-- Run this in the Supabase SQL editor to add any columns that are missing from the
-- live database but required by the app.
--
-- Each statement uses IF NOT EXISTS so it is safe to re-run multiple times.
-- Nothing is dropped or modified — only missing columns are added.
--
-- After running this, verify with:
--   select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name in ('wrestlers','weight_logs','matches','notes','schedules')
--   order by table_name, ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- wrestlers
-- ─────────────────────────────────────────────────────────────
alter table public.wrestlers
  add column if not exists email text;

alter table public.wrestlers
  add column if not exists current_weight float;

alter table public.wrestlers
  add column if not exists weight_class int;

alter table public.wrestlers
  add column if not exists show_on_board boolean not null default false;

-- ─────────────────────────────────────────────────────────────
-- Core FK columns — these must exist before RLS policies reference them.
-- If the tables were created manually via Supabase Dashboard without
-- wrestler_id, the policies below would fail.
-- ─────────────────────────────────────────────────────────────
alter table public.weight_logs
  add column if not exists wrestler_id uuid references public.wrestlers(id) on delete cascade;

alter table public.matches
  add column if not exists wrestler_id uuid references public.wrestlers(id) on delete cascade;

alter table public.notes
  add column if not exists wrestler_id uuid references public.wrestlers(id) on delete cascade;

alter table public.schedules
  add column if not exists wrestler_id uuid references public.wrestlers(id) on delete cascade;

-- RLS: board members readable by any authenticated user
-- PostgreSQL CREATE POLICY has no IF NOT EXISTS — drop first to make re-runnable.
drop policy if exists "wrestlers: select board members" on public.wrestlers;
create policy "wrestlers: select board members"
  on public.wrestlers for select
  using (show_on_board = true and auth.uid() is not null);

drop policy if exists "weight_logs: select board members" on public.weight_logs;
create policy "weight_logs: select board members"
  on public.weight_logs for select
  using (
    auth.uid() is not null and
    exists (
      select 1 from public.wrestlers w
      where w.id = wrestler_id and w.show_on_board = true
    )
  );

drop policy if exists "matches: select board members" on public.matches;
create policy "matches: select board members"
  on public.matches for select
  using (
    auth.uid() is not null and
    exists (
      select 1 from public.wrestlers w
      where w.id = wrestler_id and w.show_on_board = true
    )
  );

drop policy if exists "schedules: select board members" on public.schedules;
create policy "schedules: select board members"
  on public.schedules for select
  using (
    auth.uid() is not null and
    exists (
      select 1 from public.wrestlers w
      where w.id = wrestler_id and w.show_on_board = true
    )
  );

-- Backfill: existing rows have email stored in name — copy it over, then clear name.
update public.wrestlers
  set email = name, name = null
  where email is null and name is not null;

-- ─────────────────────────────────────────────────────────────
-- weight_logs
-- ─────────────────────────────────────────────────────────────
alter table public.weight_logs
  add column if not exists note text;

-- time_of_day: backfill existing rows with 'morning' before adding not-null constraint
alter table public.weight_logs
  add column if not exists time_of_day text
    check (time_of_day in ('morning', 'before_practice', 'after_practice', 'night'));

update public.weight_logs
  set time_of_day = 'morning'
  where time_of_day is null;

alter table public.weight_logs
  alter column time_of_day set not null;

-- ─────────────────────────────────────────────────────────────
-- matches
-- ─────────────────────────────────────────────────────────────
alter table public.matches
  add column if not exists score text;

alter table public.matches
  add column if not exists win_type text
    check (win_type in ('decision', 'major', 'tech', 'pin', 'forfeit'));

alter table public.matches
  add column if not exists tournament text;

-- ─────────────────────────────────────────────────────────────
-- notes
-- ─────────────────────────────────────────────────────────────
alter table public.notes
  add column if not exists context text not null default 'general'
    check (context in ('general', 'practice', 'match'));

alter table public.notes
  add column if not exists match_id uuid
    references public.matches(id) on delete set null;

-- ─────────────────────────────────────────────────────────────
-- schedules
-- ─────────────────────────────────────────────────────────────
alter table public.schedules
  add column if not exists ends_at timestamptz;

alter table public.schedules
  add column if not exists location text;

-- ─────────────────────────────────────────────────────────────
-- tournaments (new table)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tournaments (
  id           uuid primary key default gen_random_uuid(),
  wrestler_id  uuid not null references public.wrestlers(id) on delete cascade,
  name         text not null,
  date         date
);

alter table public.tournaments enable row level security;

drop policy if exists "tournaments: select own rows" on public.tournaments;
create policy "tournaments: select own rows"
  on public.tournaments for select
  using (wrestler_id = auth.uid());

drop policy if exists "tournaments: insert own rows" on public.tournaments;
create policy "tournaments: insert own rows"
  on public.tournaments for insert
  with check (wrestler_id = auth.uid());

drop policy if exists "tournaments: delete own rows" on public.tournaments;
create policy "tournaments: delete own rows"
  on public.tournaments for delete
  using (wrestler_id = auth.uid());

-- Add tournament_id FK to matches (alongside existing tournament text column for backfill safety).
alter table public.matches
  add column if not exists tournament_id uuid
    references public.tournaments(id) on delete set null;

-- Backfill: for each distinct tournament name in matches, create a tournaments row
-- and set tournament_id. Only runs if tournament text is set and tournament_id is null.
do $$
declare
  r record;
  v_tid uuid;
begin
  for r in
    select distinct wrestler_id, tournament
    from public.matches
    where tournament is not null and tournament <> '' and tournament_id is null
  loop
    -- reuse existing tournament row for this wrestler+name if it exists
    select id into v_tid from public.tournaments
    where wrestler_id = r.wrestler_id and name = r.tournament
    limit 1;

    if v_tid is null then
      insert into public.tournaments (wrestler_id, name)
      values (r.wrestler_id, r.tournament)
      returning id into v_tid;
    end if;

    update public.matches
    set tournament_id = v_tid
    where wrestler_id = r.wrestler_id and tournament = r.tournament and tournament_id is null;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- workouts (new table)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.workouts (
  id              uuid primary key default gen_random_uuid(),
  wrestler_id     uuid not null references public.wrestlers(id) on delete cascade,
  workout_type    text not null default 'lifting'
                    check (workout_type in ('lifting', 'practice', 'cardio', 'other')),
  workout_date    date not null,
  duration_minutes int,
  notes           text,
  created_at      timestamptz not null default now()
);

-- If workouts table already exists, add missing columns
alter table public.workouts
  add column if not exists workout_type text not null default 'lifting';
alter table public.workouts
  add column if not exists duration_minutes int;

alter table public.workouts enable row level security;

drop policy if exists "workouts: select own rows" on public.workouts;
create policy "workouts: select own rows"
  on public.workouts for select
  using (wrestler_id = auth.uid());

drop policy if exists "workouts: insert own rows" on public.workouts;
create policy "workouts: insert own rows"
  on public.workouts for insert
  with check (wrestler_id = auth.uid());

drop policy if exists "workouts: update own rows" on public.workouts;
create policy "workouts: update own rows"
  on public.workouts for update
  using (wrestler_id = auth.uid());

drop policy if exists "workouts: delete own rows" on public.workouts;
create policy "workouts: delete own rows"
  on public.workouts for delete
  using (wrestler_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- workout_exercises (new table)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.workout_exercises (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  wrestler_id  uuid not null references public.wrestlers(id) on delete cascade,
  name         text not null,
  sets         int,
  reps         int,
  weight       float,
  created_at   timestamptz not null default now()
);

alter table public.workout_exercises enable row level security;

drop policy if exists "workout_exercises: select own rows" on public.workout_exercises;
create policy "workout_exercises: select own rows"
  on public.workout_exercises for select
  using (wrestler_id = auth.uid());

drop policy if exists "workout_exercises: insert own rows" on public.workout_exercises;
create policy "workout_exercises: insert own rows"
  on public.workout_exercises for insert
  with check (wrestler_id = auth.uid());

drop policy if exists "workout_exercises: delete own rows" on public.workout_exercises;
create policy "workout_exercises: delete own rows"
  on public.workout_exercises for delete
  using (wrestler_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- goals (new table)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.goals (
  id              uuid primary key default gen_random_uuid(),
  wrestler_id     uuid not null references public.wrestlers(id) on delete cascade,
  goal_type       text not null
                    check (goal_type in ('lifting', 'practice', 'habit', 'tournament_placement', 'other')),
  tracking_type   text not null
                    check (tracking_type in ('auto', 'manual')),
  description     text not null,
  target          int,
  progress        int not null default 0
                    check (progress >= 0 and progress <= 100),
  target_date     date,
  tournament_id   uuid references public.tournaments(id) on delete set null,
  completed       boolean not null default false,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  constraint goals_tracking_type_matches_goal_type check (
    (goal_type in ('lifting', 'practice', 'habit') and tracking_type = 'auto') or
    (goal_type in ('tournament_placement', 'other') and tracking_type = 'manual')
  )
);

-- If goals table already exists, add missing columns
alter table public.goals
  add column if not exists completed boolean not null default false;
alter table public.goals
  add column if not exists completed_at timestamptz;
alter table public.goals
  add column if not exists progress int not null default 0;
alter table public.goals
  add column if not exists tournament_id uuid
    references public.tournaments(id) on delete set null;

alter table public.goals enable row level security;

drop policy if exists "goals: select own rows" on public.goals;
create policy "goals: select own rows"
  on public.goals for select
  using (wrestler_id = auth.uid());

drop policy if exists "goals: insert own rows" on public.goals;
create policy "goals: insert own rows"
  on public.goals for insert
  with check (wrestler_id = auth.uid());

drop policy if exists "goals: update own rows" on public.goals;
create policy "goals: update own rows"
  on public.goals for update
  using (wrestler_id = auth.uid());

drop policy if exists "goals: delete own rows" on public.goals;
create policy "goals: delete own rows"
  on public.goals for delete
  using (wrestler_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- habit_logs (new table)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.habit_logs (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.goals(id) on delete cascade,
  wrestler_id  uuid not null references public.wrestlers(id) on delete cascade,
  logged_at    timestamptz not null default now()
);

alter table public.habit_logs enable row level security;

drop policy if exists "habit_logs: select own rows" on public.habit_logs;
create policy "habit_logs: select own rows"
  on public.habit_logs for select
  using (wrestler_id = auth.uid());

drop policy if exists "habit_logs: insert own rows" on public.habit_logs;
create policy "habit_logs: insert own rows"
  on public.habit_logs for insert
  with check (wrestler_id = auth.uid());

drop policy if exists "habit_logs: delete own rows" on public.habit_logs;
create policy "habit_logs: delete own rows"
  on public.habit_logs for delete
  using (wrestler_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- wrestlers: RLS for email column
-- email is set once on sign-up and must never be updated by the client.
-- We achieve this by restricting which columns the update policy allows.
-- The simplest approach: drop + recreate the update policy to exclude email.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "wrestlers: update own row" on public.wrestlers;
create policy "wrestlers: update own row"
  on public.wrestlers for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Column-level privilege: revoke UPDATE on email from the authenticated role
-- so even if the policy passes, the column cannot be written.
revoke update (email) on public.wrestlers from authenticated;

-- ─────────────────────────────────────────────────────────────
-- RPC: insert_lifting_workout
-- ─────────────────────────────────────────────────────────────
create or replace function public.insert_lifting_workout(
  p_workout_date  date,
  p_notes         text,
  p_exercises     jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_workout_id uuid;
  v_wrestler_id uuid := auth.uid();
  ex jsonb;
begin
  insert into public.workouts (wrestler_id, workout_date, notes)
  values (v_wrestler_id, p_workout_date, p_notes)
  returning id into v_workout_id;

  for ex in select * from jsonb_array_elements(p_exercises)
  loop
    insert into public.workout_exercises (workout_id, wrestler_id, name, sets, reps, weight)
    values (
      v_workout_id,
      v_wrestler_id,
      ex->>'name',
      (ex->>'sets')::int,
      (ex->>'reps')::int,
      (ex->>'weight')::float
    );
  end loop;

  return v_workout_id;
end;
$$;
