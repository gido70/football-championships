-- بطولة البلايستيشن المصاحبة لكأس منصور 2027
create table if not exists public.playstation_competitions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null unique references public.tournaments(id) on delete cascade,
  title text not null default 'بطولة البلايستيشن للصغار',
  subtitle text,
  status text not null default 'draft' check (status in ('draft','open','live','completed')),
  participant_target integer not null default 30 check (participant_target between 2 and 128),
  groups_count integer not null default 6 check (groups_count between 1 and 16),
  group_size integer not null default 5 check (group_size between 2 and 16),
  qualifiers_per_group integer not null default 2 check (qualifiers_per_group between 1 and 8),
  best_thirds_count integer not null default 4 check (best_thirds_count between 0 and 16),
  win_points integer not null default 3,
  draw_points integer not null default 1,
  loss_points integer not null default 0,
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playstation_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.playstation_competitions(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  nickname text,
  photo_url text,
  group_code text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.playstation_matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.playstation_competitions(id) on delete cascade,
  stage text not null default 'group' check (stage in ('group','round_of_16','quarter_final','semi_final','third_place','final')),
  group_code text,
  round_no integer,
  player1_id uuid references public.playstation_participants(id) on delete set null,
  player2_id uuid references public.playstation_participants(id) on delete set null,
  score1 integer check (score1 is null or score1 >= 0),
  score2 integer check (score2 is null or score2 >= 0),
  penalties1 integer check (penalties1 is null or penalties1 >= 0),
  penalties2 integer check (penalties2 is null or penalties2 >= 0),
  status text not null default 'scheduled' check (status in ('scheduled','live','completed')),
  match_order integer not null default 0,
  station_no integer,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (player1_id is null or player2_id is null or player1_id <> player2_id)
);

create table if not exists public.playstation_admins (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'operator' check (role in ('owner','operator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tournament_id,user_id)
);

create index if not exists playstation_participants_comp_idx on public.playstation_participants(competition_id,group_code,sort_order);
create index if not exists playstation_matches_comp_idx on public.playstation_matches(competition_id,status,match_order);

alter table public.playstation_competitions enable row level security;
alter table public.playstation_participants enable row level security;
alter table public.playstation_matches enable row level security;
alter table public.playstation_admins enable row level security;

grant select on public.playstation_competitions,public.playstation_participants,public.playstation_matches to anon,authenticated;
grant insert,update,delete on public.playstation_competitions,public.playstation_participants,public.playstation_matches to authenticated;
grant select on public.playstation_admins to authenticated;

drop policy if exists "public view visible playstation competitions" on public.playstation_competitions;
create policy "public view visible playstation competitions" on public.playstation_competitions for select to anon,authenticated
using (is_visible or exists (select 1 from public.playstation_admins a where a.tournament_id=playstation_competitions.tournament_id and a.user_id=(select auth.uid()) and a.is_active));
drop policy if exists "scoped operators manage playstation competitions" on public.playstation_competitions;
create policy "scoped operators manage playstation competitions" on public.playstation_competitions for all to authenticated
using (exists (select 1 from public.playstation_admins a where a.tournament_id=playstation_competitions.tournament_id and a.user_id=(select auth.uid()) and a.is_active))
with check (exists (select 1 from public.playstation_admins a where a.tournament_id=playstation_competitions.tournament_id and a.user_id=(select auth.uid()) and a.is_active));

drop policy if exists "public view participants of visible competition" on public.playstation_participants;
create policy "public view participants of visible competition" on public.playstation_participants for select to anon,authenticated
using (exists (select 1 from public.playstation_competitions c where c.id=competition_id and (c.is_visible or exists (select 1 from public.playstation_admins a where a.tournament_id=c.tournament_id and a.user_id=(select auth.uid()) and a.is_active))));
drop policy if exists "scoped operators manage playstation participants" on public.playstation_participants;
create policy "scoped operators manage playstation participants" on public.playstation_participants for all to authenticated
using (exists (select 1 from public.playstation_competitions c join public.playstation_admins a on a.tournament_id=c.tournament_id where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active))
with check (exists (select 1 from public.playstation_competitions c join public.playstation_admins a on a.tournament_id=c.tournament_id where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active));

drop policy if exists "public view matches of visible competition" on public.playstation_matches;
create policy "public view matches of visible competition" on public.playstation_matches for select to anon,authenticated
using (exists (select 1 from public.playstation_competitions c where c.id=competition_id and (c.is_visible or exists (select 1 from public.playstation_admins a where a.tournament_id=c.tournament_id and a.user_id=(select auth.uid()) and a.is_active))));
drop policy if exists "scoped operators manage playstation matches" on public.playstation_matches;
create policy "scoped operators manage playstation matches" on public.playstation_matches for all to authenticated
using (exists (select 1 from public.playstation_competitions c join public.playstation_admins a on a.tournament_id=c.tournament_id where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active))
with check (exists (select 1 from public.playstation_competitions c join public.playstation_admins a on a.tournament_id=c.tournament_id where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active));

drop policy if exists "operators view own playstation scope" on public.playstation_admins;
create policy "operators view own playstation scope" on public.playstation_admins for select to authenticated
using (user_id=(select auth.uid()));

insert into public.playstation_admins(tournament_id,user_id,display_name,role)
values ('c983ee0c-4434-470d-b0a2-6e6efe1ad650','674ed5de-14c3-47db-b88f-68cb5f50005d','مدير البطولة','owner')
on conflict (tournament_id,user_id) do update set is_active=true,role='owner';

insert into public.playstation_competitions(tournament_id,title,subtitle,status,is_visible)
values ('c983ee0c-4434-470d-b0a2-6e6efe1ad650','بطولة البلايستيشن للصغار','الفعالية المصاحبة لكأس منصور 2027','draft',false)
on conflict (tournament_id) do nothing;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='playstation_matches') then
    alter publication supabase_realtime add table public.playstation_matches;
  end if;
end $$;
