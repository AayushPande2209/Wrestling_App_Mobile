-- Pursuit Wrestling App — Full Schema
-- Run this in the Supabase SQL editor to create all tables and RLS policies from scratch.
-- Safe to re-run: uses IF NOT EXISTS for tables, DROP/CREATE for policies.
--
-- Tables: wrestlers, weight_logs, matches, notes, schedules
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
-- matches
-- ─────────────────────────────────────────────────────────────

create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  wrestler_id   uuid not null references public.wrestlers(id) on delete cascade,
  opponent_name text,
  result        text check (result in ('win', 'loss', 'draw')),
  score         text,
  win_type      text check (win_type in ('decision', 'major', 'tech', 'pin', 'forfeit')),
  tournament    text,
  match_date    date not null,
  created_at    timestamptz not null default now()
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
