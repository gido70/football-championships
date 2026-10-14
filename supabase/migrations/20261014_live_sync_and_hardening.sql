-- Applied directly on 2026-10-13/14 (record for the repo).
create table if not exists public.live_sync_event_imports (
  match_id uuid primary key references public.matches(id) on delete cascade,
  source text, attempts integer not null default 0, imported_at timestamptz,
  last_attempt_at timestamptz default now(), events_seen integer default 0,
  inserted integer default 0, updated integer default 0, details jsonb);
alter table public.live_sync_event_imports enable row level security;
alter table public.matches add column if not exists auto_live_managed boolean not null default false;
alter table public.matches add column if not exists live_sync_enabled boolean not null default true;
alter table public.matches add column if not exists added_minutes smallint check (added_minutes is null or added_minutes between 1 and 20);
-- match_predictions hardening: drop blanket ALL policies, range checks, lock after kick-off
drop policy if exists "public write predictions" on public.match_predictions;
drop policy if exists "public write" on public.match_predictions;
drop policy if exists "public read predictions" on public.match_predictions;
drop policy if exists "public read" on public.match_predictions;
-- (constraints + guard_match_prediction trigger: see migration harden_match_predictions in Supabase)
