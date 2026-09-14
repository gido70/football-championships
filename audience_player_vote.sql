-- Anonymous audience vote for player of the match.
-- One browser token may vote once per match. Raw voter tokens stay private.

create schema if not exists private;

create or replace function private.match_vote_is_open(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and m.player_of_match_id is null
      and (
        lower(coalesce(m.status,'')) = 'live'
        or (
          lower(coalesce(m.status,'')) in ('completed','finished','ended')
          and m.live_started_at is not null
          and not exists (
            select 1
            from public.matches n
            where n.tournament_id = m.tournament_id
              and n.id <> m.id
              and lower(coalesce(n.status,'')) in ('live','completed','finished','ended')
              and n.live_started_at is not null
              and n.live_started_at > m.live_started_at
          )
        )
      )
  );
$$;

revoke all on function private.match_vote_is_open(uuid) from public,anon,authenticated;

create or replace function public.get_match_vote_state(p_match_id uuid,p_session_key text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'open',private.match_vote_is_open(p_match_id),
    'my_player_id',(
      select v.player_id from public.match_votes v
      where v.match_id=p_match_id and p_session_key is not null and v.session_key=p_session_key
      limit 1
    ),
    'total_votes',(select count(*) from public.match_votes v where v.match_id=p_match_id),
    'counts',coalesce((
      select jsonb_agg(jsonb_build_object('player_id',x.player_id,'votes',x.votes) order by x.votes desc,x.player_id)
      from (
        select v.player_id,count(*)::bigint as votes
        from public.match_votes v
        where v.match_id=p_match_id and v.player_id is not null
        group by v.player_id
      ) x
    ),'[]'::jsonb)
  );
$$;

create or replace function public.get_match_vote_leaders(p_match_ids uuid[])
returns table(match_id uuid,player_id uuid,votes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with counts as (
    select v.match_id,v.player_id,count(*)::bigint as votes,
           row_number() over(partition by v.match_id order by count(*) desc,v.player_id) as rank_no
    from public.match_votes v
    where cardinality(p_match_ids) between 1 and 50
      and v.match_id=any(p_match_ids)
      and v.player_id is not null
    group by v.match_id,v.player_id
  )
  select c.match_id,c.player_id,c.votes from counts c where c.rank_no=1;
$$;

create or replace function public.cast_match_vote_public(p_match_id uuid,p_player_id uuid,p_session_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
  v_inserted_id uuid;
  v_existing_player uuid;
begin
  if p_session_key is null or p_session_key !~ '^[a-z0-9]{16,80}$' then
    return jsonb_build_object('status','invalid_device');
  end if;

  select m.tournament_id into v_tournament_id
  from public.matches m
  join public.players p on p.id=p_player_id
  where m.id=p_match_id
    and p.tournament_id=m.tournament_id
    and p.team_id in(m.home_team_id,m.away_team_id);

  if v_tournament_id is null then
    return jsonb_build_object('status','invalid_player');
  end if;

  if not private.match_vote_is_open(p_match_id) then
    return jsonb_build_object('status','closed');
  end if;

  insert into public.match_votes(match_id,tournament_id,player_id,session_key)
  values(p_match_id,v_tournament_id,p_player_id,p_session_key)
  on conflict(match_id,session_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select v.player_id into v_existing_player
    from public.match_votes v
    where v.match_id=p_match_id and v.session_key=p_session_key;
    return jsonb_build_object('status','already_voted','player_id',v_existing_player);
  end if;

  return jsonb_build_object('status','recorded','player_id',p_player_id);
end;
$$;

revoke all on function public.get_match_vote_state(uuid,text) from public;
revoke all on function public.get_match_vote_leaders(uuid[]) from public;
revoke all on function public.cast_match_vote_public(uuid,uuid,text) from public;
grant execute on function public.get_match_vote_state(uuid,text) to anon,authenticated;
grant execute on function public.get_match_vote_leaders(uuid[]) to anon,authenticated;
grant execute on function public.cast_match_vote_public(uuid,uuid,text) to anon,authenticated;

-- Apply this final hardening only after the updated frontend is live.
alter table public.match_votes enable row level security;
revoke all on table public.match_votes from public,anon,authenticated;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='match_votes'
  loop
    execute format('drop policy if exists %I on public.match_votes',p.policyname);
  end loop;
end $$;
