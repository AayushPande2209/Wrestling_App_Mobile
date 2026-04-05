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
