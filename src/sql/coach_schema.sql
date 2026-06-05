-- ─────────────────────────────────────────────────────────────
-- Coach AI — Database Migration
-- Run once in the Supabase SQL editor.
-- Safe to re-run: all statements use IF NOT EXISTS or are idempotent.
-- ─────────────────────────────────────────────────────────────

-- 1. Add coach_profile column to wrestlers
--    Stores the onboarding answers as JSON. Null means the wrestler
--    hasn't completed onboarding yet — the /coach page uses this to
--    decide whether to show the onboarding flow or the chat.
alter table public.wrestlers
  add column if not exists coach_profile jsonb default null;

-- 2. Create coach_messages table
--    Persistent chat history. The backend reads these to maintain
--    conversation context across sessions.
create table if not exists public.coach_messages (
  id           uuid primary key default gen_random_uuid(),
  wrestler_id  uuid not null references public.wrestlers(id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  created_at   timestamptz not null default now()
);

-- Index for fast per-wrestler history lookups
create index if not exists coach_messages_wrestler_created
  on public.coach_messages (wrestler_id, created_at);

alter table public.coach_messages enable row level security;

-- RLS: wrestlers can only read and insert their own messages
drop policy if exists "coach_messages: select own rows" on public.coach_messages;
create policy "coach_messages: select own rows"
  on public.coach_messages for select
  using (wrestler_id = auth.uid());

drop policy if exists "coach_messages: insert own rows" on public.coach_messages;
create policy "coach_messages: insert own rows"
  on public.coach_messages for insert
  with check (wrestler_id = auth.uid());
