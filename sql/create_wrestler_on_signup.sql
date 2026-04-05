-- Trigger: auto-insert a row into public.wrestlers when a new user signs up.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- What it does:
--   1. Creates a function that inserts into wrestlers (id, name) using the new
--      auth user's id and email.  ON CONFLICT DO NOTHING makes it idempotent.
--   2. Attaches the function as an AFTER INSERT trigger on auth.users.
--
-- This eliminates the race condition where supabase.auth.signUp() succeeds but
-- the client-side wrestlers insert fails, leaving the user with no wrestlers row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wrestlers (id, email, name)
  values (new.id, new.email, null)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop the trigger first so this script is safe to re-run.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
