-- Pursuit Wrestling App — Full Schema
-- Run this in the Supabase SQL editor to create all tables and RLS policies from scratch.
-- Safe to re-run: uses IF NOT EXISTS for tables, DROP/CREATE for policies.
--
-- Tables: wrestlers, weight_logs, matches, notes, schedules,
--         tournaments, workouts, workout_exercises, goals, habit_logs
-- After running this file, also run:
--   sql/create_wrestler_on_signup.sql  (auth trigger)

-- ─────────────────────────────────────────────────────────────
-- wrestlers
-- ─────────────────────────────────────────────────────────────

create table if not exists public.wrestlers (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text,
  name           text,
  current_weight float,
  weight_class   int,
  show_on_board  boolean not null default false
);

alter table public.wrestlers enable row level security;

drop policy if exists "wrestlers: select own row" on public.wrestlers;
create policy "wrestlers: select own row"
  on public.wrestlers for select
  using (id = auth.uid());

-- Any authenticated user can read wrestlers who opted in to the board/feed.
drop policy if exists "wrestlers: select board members" on public.wrestlers;
create policy "wrestlers: select board members"
  on public.wrestlers for select
  using (show_on_board = true and auth.uid() is not null);

drop policy if exists "wrestlers: update own row" on public.wrestlers;
create policy "wrestlers: update own row"
  on public.wrestlers for update
  using (id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- weight_logs
-- ─────────────────────────────────────────────────────────────

create table if not exists public.weight_logs (
  id           uuid primary key default gen_random_uuid(),
  wrestler_id  uuid not null references public.wrestlers(id) on delete cascade,
  weight       float not null,
  time_of_day  text not null check (time_of_day in ('morning', 'before_practice', 'after_practice', 'night')),
  note         text,
  logged_at    timestamptz not null default now()
);

alter table public.weight_logs enable row level security;

drop policy if exists "weight_logs: select own rows" on public.weight_logs;
create policy "weight_logs: select own rows"
  on public.weight_logs for select
  using (wrestler_id = auth.uid());

-- Any authenticated user can read weight_logs from opted-in wrestlers (activity feed).
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

drop policy if exists "weight_logs: insert own rows" on public.weight_logs;
create policy "weight_logs: insert own rows"
  on public.weight_logs for insert
  with check (wrestler_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- tournaments (created before matches so matches can FK to it)
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

-- ─────────────────────────────────────────────────────────────
-- matches
-- ─────────────────────────────────────────────────────────────

create table if not exists public.matches (
  id              uuid primary key default gen_random_uuid(),
  wrestler_id     uuid not null references public.wrestlers(id) on delete cascade,
  opponent_name   text,
  result          text check (result in ('win', 'loss', 'draw')),
  score           text,
  win_type        text check (win_type in ('decision', 'major', 'tech', 'pin', 'forfeit')),
  tournament_id   uuid references public.tournaments(id) on delete set null,
  match_date      date not null,
  created_at      timestamptz not null default now()
);

alter table public.matches enable row level security;

drop policy if exists "matches: select own rows" on public.matches;
create policy "matches: select own rows"
  on public.matches for select
  using (wrestler_id = auth.uid());

-- Any authenticated user can read matches from opted-in wrestlers (activity feed).
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

drop policy if exists "matches: insert own rows" on public.matches;
create policy "matches: insert own rows"
  on public.matches for insert
  with check (wrestler_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- notes
-- ─────────────────────────────────────────────────────────────

create table if not exists public.notes (
  id           uuid primary key default gen_random_uuid(),
  wrestler_id  uuid not null references public.wrestlers(id) on delete cascade,
  body         text not null,
  context      text not null default 'general'
                 check (context in ('general', 'practice', 'match')),
  match_id     uuid references public.matches(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "notes: select own rows" on public.notes;
create policy "notes: select own rows"
  on public.notes for select
  using (wrestler_id = auth.uid());

drop policy if exists "notes: insert own rows" on public.notes;
create policy "notes: insert own rows"
  on public.notes for insert
  with check (wrestler_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- schedules
-- ─────────────────────────────────────────────────────────────

create table if not exists public.schedules (
  id           uuid primary key default gen_random_uuid(),
  wrestler_id  uuid not null references public.wrestlers(id) on delete cascade,
  title        text not null,
  event_type   text check (event_type in ('practice', 'tournament', 'dual meet', 'other')),
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  location     text
);

alter table public.schedules enable row level security;

drop policy if exists "schedules: select own rows" on public.schedules;
create policy "schedules: select own rows"
  on public.schedules for select
  using (wrestler_id = auth.uid());

-- Any authenticated user can read schedules from opted-in wrestlers (activity feed).
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

drop policy if exists "schedules: insert own rows" on public.schedules;
create policy "schedules: insert own rows"
  on public.schedules for insert
  with check (wrestler_id = auth.uid());

drop policy if exists "schedules: update own rows" on public.schedules;
create policy "schedules: update own rows"
  on public.schedules for update
  using (wrestler_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- workouts
-- ─────────────────────────────────────────────────────────────

create table if not exists public.workouts (
  id            uuid primary key default gen_random_uuid(),
  wrestler_id   uuid not null references public.wrestlers(id) on delete cascade,
  workout_date  date not null,
  notes         text,
  created_at    timestamptz not null default now()
);

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
-- workout_exercises
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
-- goals
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
  -- lifting/practice/habit goals always auto-tracked; tournament_placement/other always manual
  constraint goals_tracking_type_matches_goal_type check (
    (goal_type in ('lifting', 'practice', 'habit') and tracking_type = 'auto') or
    (goal_type in ('tournament_placement', 'other') and tracking_type = 'manual')
  )
);

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
-- habit_logs
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
-- RPC: insert_lifting_workout
-- Inserts a workout + its exercises in a single transaction.
-- Never trust wrestler_id from the client — always derive from auth.uid().
-- ─────────────────────────────────────────────────────────────

create or replace function public.insert_lifting_workout(
  p_workout_date  date,
  p_notes         text,
  p_exercises     jsonb   -- array of {name, sets, reps, weight}
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
