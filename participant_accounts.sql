-- حسابات جمهور معزولة عن حسابات الإدارة وعن بيانات البطولات الحالية.
create table if not exists public.participant_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  participant_code text not null unique,
  first_name text not null check (char_length(trim(first_name)) between 2 and 50),
  family_name text not null check (char_length(trim(family_name)) between 2 and 50),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint participant_code_six_digits check (participant_code ~ '^[0-9]{6}$')
);

create table if not exists public.participant_tournament_memberships (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participant_profiles(user_id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (participant_id, tournament_id)
);

alter table public.participant_profiles enable row level security;
alter table public.participant_tournament_memberships enable row level security;

create or replace function public.assign_participant_code()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare candidate text;
begin
  loop
    candidate := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.participant_profiles where participant_code = candidate);
  end loop;
  new.participant_code := candidate;
  return new;
end;
$$;

drop trigger if exists trg_assign_participant_code on public.participant_profiles;
create trigger trg_assign_participant_code
before insert on public.participant_profiles
for each row execute function public.assign_participant_code();

drop policy if exists participant_self_read on public.participant_profiles;
create policy participant_self_read on public.participant_profiles for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists participant_self_insert on public.participant_profiles;
create policy participant_self_insert on public.participant_profiles for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists participant_self_update on public.participant_profiles;
create policy participant_self_update on public.participant_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and status = 'active');
drop policy if exists participant_admin_read on public.participant_profiles;
create policy participant_admin_read on public.participant_profiles for select to authenticated
using ((select auth.uid()) = '674ed5de-14c3-47db-b88f-68cb5f50005d'::uuid);

drop policy if exists membership_self_read on public.participant_tournament_memberships;
create policy membership_self_read on public.participant_tournament_memberships for select to authenticated
using ((select auth.uid()) = participant_id);
drop policy if exists membership_self_insert on public.participant_tournament_memberships;
create policy membership_self_insert on public.participant_tournament_memberships for insert to authenticated
with check ((select auth.uid()) = participant_id);
drop policy if exists membership_admin_read on public.participant_tournament_memberships;
create policy membership_admin_read on public.participant_tournament_memberships for select to authenticated
using ((select auth.uid()) = '674ed5de-14c3-47db-b88f-68cb5f50005d'::uuid);

grant select, insert, update on public.participant_profiles to authenticated;
grant select, insert on public.participant_tournament_memberships to authenticated;
revoke all on public.participant_profiles from anon;
revoke all on public.participant_tournament_memberships from anon;

comment on column public.participant_profiles.participant_code is
'رقم تعريف من ستة أرقام، وليس كلمة مرور أو وسيلة مصادقة.';
