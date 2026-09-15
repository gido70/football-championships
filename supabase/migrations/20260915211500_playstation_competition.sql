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
  stations_count integer not null default 8 check (stations_count between 1 and 12),
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playstation_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.playstation_competitions(id) on delete cascade,
  participant_no integer check (participant_no is null or participant_no between 1 and 128),
  name text not null check (char_length(trim(name)) between 2 and 80),
  nickname text,
  photo_url text,
  photo_path text,
  photo_public boolean not null default false,
  group_code text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.playstation_participants add column if not exists participant_no integer check (participant_no is null or participant_no between 1 and 128);
alter table public.playstation_participants add column if not exists photo_path text;
alter table public.playstation_participants add column if not exists photo_public boolean not null default false;

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
  wave_no integer,
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
  device_token text,
  device_bound_at timestamptz,
  primary key (tournament_id,user_id)
);
alter table public.playstation_competitions add column if not exists stations_count integer not null default 8 check (stations_count between 1 and 12);
alter table public.playstation_matches add column if not exists wave_no integer;
alter table public.playstation_admins add column if not exists device_token text;
alter table public.playstation_admins add column if not exists device_bound_at timestamptz;

create index if not exists playstation_participants_comp_idx on public.playstation_participants(competition_id,group_code,sort_order);
create unique index if not exists playstation_participants_number_uidx on public.playstation_participants(competition_id,participant_no) where participant_no is not null;
create index if not exists playstation_matches_comp_idx on public.playstation_matches(competition_id,status,match_order);

alter table public.playstation_competitions enable row level security;
alter table public.playstation_participants enable row level security;
alter table public.playstation_matches enable row level security;
alter table public.playstation_admins enable row level security;

grant select on public.playstation_competitions,public.playstation_participants,public.playstation_matches to anon,authenticated;
grant insert,update,delete on public.playstation_competitions,public.playstation_participants,public.playstation_matches to authenticated;
grant select on public.playstation_admins to authenticated;
grant update (device_token,device_bound_at) on public.playstation_admins to authenticated;

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

-- أول جهاز يستخدم حساب المشغّل يصبح الجهاز المعتمد. المالك غير مقيّد بجهاز.
create or replace function public.claim_playstation_operator_device(p_tournament_id uuid,p_device_token text)
returns boolean language plpgsql security definer set search_path=public as $$
declare claimed boolean;
begin
  if (select auth.uid()) is null or p_device_token is null or char_length(p_device_token) < 20 then return false; end if;
  update public.playstation_admins
     set device_token=coalesce(device_token,p_device_token),device_bound_at=coalesce(device_bound_at,now())
   where tournament_id=p_tournament_id and user_id=(select auth.uid()) and is_active
     and (role='owner' or device_token is null or device_token=p_device_token)
  returning true into claimed;
  return coalesce(claimed,false);
end $$;
revoke all on function public.claim_playstation_operator_device(uuid,text) from public,anon;
grant execute on function public.claim_playstation_operator_device(uuid,text) to authenticated;

-- صور المشاركين: القراءة عامة للبطولة، والرفع محصور بمالك البطولة أو مشغّلها المخوّل.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('playstation-photos','playstation-photos',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "playstation scoped view participant photos" on storage.objects;
create policy "playstation scoped view participant photos" on storage.objects for select to anon,authenticated
using (bucket_id='playstation-photos' and ((exists (select 1 from public.playstation_participants p join public.playstation_competitions c on c.id=p.competition_id where p.photo_path=storage.objects.name and p.photo_public and c.is_visible)) or (exists (select 1 from public.playstation_admins a where a.tournament_id='c983ee0c-4434-470d-b0a2-6e6efe1ad650' and a.user_id=(select auth.uid()) and a.is_active))));

drop policy if exists "playstation operators upload participant photos" on storage.objects;
create policy "playstation operators upload participant photos" on storage.objects for insert to authenticated
with check (bucket_id='playstation-photos' and (storage.foldername(name))[1]='c983ee0c-4434-470d-b0a2-6e6efe1ad650' and exists (select 1 from public.playstation_admins a where a.tournament_id='c983ee0c-4434-470d-b0a2-6e6efe1ad650' and a.user_id=(select auth.uid()) and a.is_active and a.role='owner'));
drop policy if exists "playstation operators update participant photos" on storage.objects;
create policy "playstation operators update participant photos" on storage.objects for update to authenticated
using (bucket_id='playstation-photos' and (storage.foldername(name))[1]='c983ee0c-4434-470d-b0a2-6e6efe1ad650' and exists (select 1 from public.playstation_admins a where a.tournament_id='c983ee0c-4434-470d-b0a2-6e6efe1ad650' and a.user_id=(select auth.uid()) and a.is_active and a.role='owner'))
with check (bucket_id='playstation-photos' and (storage.foldername(name))[1]='c983ee0c-4434-470d-b0a2-6e6efe1ad650' and exists (select 1 from public.playstation_admins a where a.tournament_id='c983ee0c-4434-470d-b0a2-6e6efe1ad650' and a.user_id=(select auth.uid()) and a.is_active and a.role='owner'));

-- المالك يجهّز البطولة؛ المشغّل يحدّث النتيجة والحالة فقط.
drop policy if exists "scoped operators manage playstation competitions" on public.playstation_competitions;
create policy "playstation owner manages competition" on public.playstation_competitions for all to authenticated
using (exists (select 1 from public.playstation_admins a where a.tournament_id=playstation_competitions.tournament_id and a.user_id=(select auth.uid()) and a.is_active and a.role='owner'))
with check (exists (select 1 from public.playstation_admins a where a.tournament_id=playstation_competitions.tournament_id and a.user_id=(select auth.uid()) and a.is_active and a.role='owner'));
drop policy if exists "scoped operators manage playstation participants" on public.playstation_participants;
create policy "playstation owner manages participants" on public.playstation_participants for all to authenticated
using (exists (select 1 from public.playstation_competitions c join public.playstation_admins a on a.tournament_id=c.tournament_id where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active and a.role='owner'))
with check (exists (select 1 from public.playstation_competitions c join public.playstation_admins a on a.tournament_id=c.tournament_id where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active and a.role='owner'));
drop policy if exists "scoped operators manage playstation matches" on public.playstation_matches;
create policy "playstation owner creates and deletes matches" on public.playstation_matches for all to authenticated
using (exists (select 1 from public.playstation_competitions c join public.playstation_admins a on a.tournament_id=c.tournament_id where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active and a.role='owner'))
with check (exists (select 1 from public.playstation_competitions c join public.playstation_admins a on a.tournament_id=c.tournament_id where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active and a.role='owner'));
create policy "playstation operator updates matches" on public.playstation_matches for update to authenticated
using (exists (select 1 from public.playstation_competitions c join public.playstation_admins a on a.tournament_id=c.tournament_id where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active and (a.role='owner' or a.device_token=current_setting('request.headers',true)::jsonb->>'x-ps-device')))
with check (exists (select 1 from public.playstation_competitions c join public.playstation_admins a on a.tournament_id=c.tournament_id where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active and (a.role='owner' or a.device_token=current_setting('request.headers',true)::jsonb->>'x-ps-device')));

create or replace function public.guard_playstation_operator_match_update()
returns trigger language plpgsql security invoker set search_path=public as $$
declare operator_role text;
begin
  select a.role into operator_role from public.playstation_admins a join public.playstation_competitions c on c.tournament_id=a.tournament_id where c.id=old.competition_id and a.user_id=(select auth.uid()) and a.is_active limit 1;
  if operator_role='operator' and (new.competition_id,new.stage,new.group_code,new.round_no,new.player1_id,new.player2_id,new.match_order,new.station_no,new.wave_no,new.scheduled_at) is distinct from (old.competition_id,old.stage,old.group_code,old.round_no,old.player1_id,old.player2_id,old.match_order,old.station_no,old.wave_no,old.scheduled_at) then
    raise exception 'مشغّل الصالة مخوّل بتسجيل النتيجة وحالة المباراة فقط';
  end if;
  return new;
end $$;
drop trigger if exists guard_playstation_operator_match_update on public.playstation_matches;
create trigger guard_playstation_operator_match_update before update on public.playstation_matches for each row execute function public.guard_playstation_operator_match_update();

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
