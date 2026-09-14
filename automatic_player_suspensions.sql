-- Automatic one-match suspensions for Europe and Mansour 2027.
-- Production migration history:
--   automatic_player_suspensions
--   fix_suspension_uuid_aggregation
--   fix_suspension_match_ordering
-- The live database is the authoritative deployed version.

create schema if not exists private;

create table if not exists public.player_suspensions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  source_match_id uuid not null references public.matches(id) on delete cascade,
  reason text not null check (reason in ('direct_red','second_yellow')),
  matches_total integer not null default 1 check (matches_total > 0),
  status text not null default 'pending' check (status in ('pending','served','cancelled')),
  served_match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now(),
  served_at timestamptz,
  unique(player_id, source_match_id)
);

create index if not exists idx_player_suspensions_pending_team
  on public.player_suspensions(team_id, status, created_at);
create index if not exists idx_player_suspensions_player
  on public.player_suspensions(player_id, status);

alter table public.player_suspensions enable row level security;
drop policy if exists player_suspensions_owner_read on public.player_suspensions;
create policy player_suspensions_owner_read on public.player_suspensions
for select to authenticated
using ((select auth.uid()) = '674ed5de-14c3-47db-b88f-68cb5f50005d'::uuid);
revoke all on public.player_suspensions from anon;
grant select on public.player_suspensions to authenticated;

create or replace function private.refresh_player_suspension_counter(p_player_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.players
  set suspended_matches_remaining=(
    select count(*)::integer from public.player_suspensions
    where player_id=p_player_id and status='pending'
  ),updated_at=now()
  where id=p_player_id;
$$;

create or replace function private.recompute_player_suspension(
  p_tournament_id uuid,p_match_id uuid,p_player_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_red integer;v_yellow integer;v_team_id uuid;v_reason text;
begin
  if p_player_id is null or p_tournament_id not in (
    'eee33333-5d2a-4f3b-a981-d4b8f5f86143'::uuid,
    'c983ee0c-4434-470d-b0a2-6e6efe1ad650'::uuid
  ) then return; end if;
  select count(*) filter(where event_type='red_card')::integer,
         count(*) filter(where event_type='yellow_card')::integer,
         (array_agg(team_id order by created_at desc) filter(where team_id is not null))[1]
  into v_red,v_yellow,v_team_id
  from public.match_events
  where tournament_id=p_tournament_id and match_id=p_match_id
    and player_id=p_player_id and event_type in ('yellow_card','red_card');
  v_reason:=case when coalesce(v_red,0)>0 then 'direct_red'
                 when coalesce(v_yellow,0)>=2 then 'second_yellow' end;
  if v_reason is not null and v_team_id is not null then
    insert into public.player_suspensions(tournament_id,player_id,team_id,source_match_id,reason,status)
    values(p_tournament_id,p_player_id,v_team_id,p_match_id,v_reason,'pending')
    on conflict(player_id,source_match_id) do update
    set reason=excluded.reason,team_id=excluded.team_id,tournament_id=excluded.tournament_id,
        status=case when player_suspensions.status='cancelled' then 'pending' else player_suspensions.status end,
        served_match_id=case when player_suspensions.status='cancelled' then null else player_suspensions.served_match_id end,
        served_at=case when player_suspensions.status='cancelled' then null else player_suspensions.served_at end;
  else
    update public.player_suspensions set status='cancelled',served_match_id=null,served_at=null
    where player_id=p_player_id and source_match_id=p_match_id and status='pending';
  end if;
  perform private.refresh_player_suspension_counter(p_player_id);
end;$$;

create or replace function private.sync_card_suspension()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.event_type in ('yellow_card','red_card') then
    perform private.recompute_player_suspension(old.tournament_id,old.match_id,old.player_id);
  end if;
  if tg_op in ('INSERT','UPDATE') and new.event_type in ('yellow_card','red_card') then
    perform private.recompute_player_suspension(new.tournament_id,new.match_id,new.player_id);
  end if;
  return coalesce(new,old);
end;$$;
drop trigger if exists trg_sync_card_suspension on public.match_events;
create trigger trg_sync_card_suspension after insert or update or delete on public.match_events
for each row execute function private.sync_card_suspension();

create or replace function private.serve_player_suspensions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_player_id uuid;
begin
  if new.status<>'completed' or old.status is not distinct from new.status then return new; end if;
  for v_player_id in
    update public.player_suspensions s set status='served',served_match_id=new.id,served_at=now()
    where s.status='pending' and s.source_match_id<>new.id
      and s.team_id in(new.home_team_id,new.away_team_id,new.team1_id,new.team2_id)
      and exists(
        select 1 from public.matches src where src.id=s.source_match_id
        and (coalesce(new.match_date,'0001-01-01'),coalesce(new.match_time,'00:00:00'),coalesce(new.match_no,new.match_number,0),new.created_at)
          >(coalesce(src.match_date,'0001-01-01'),coalesce(src.match_time,'00:00:00'),coalesce(src.match_no,src.match_number,0),src.created_at)
      )
    returning s.player_id
  loop perform private.refresh_player_suspension_counter(v_player_id); end loop;
  return new;
end;$$;
drop trigger if exists trg_serve_player_suspensions on public.matches;
create trigger trg_serve_player_suspensions after update of status on public.matches
for each row execute function private.serve_player_suspensions();
