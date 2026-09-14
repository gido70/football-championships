-- Atomic live-match administration.
-- Core state and score changes happen in one database transaction; push delivery
-- remains idempotent in the authenticated Edge Function.

create or replace function public.save_live_match_event_admin(
  p_match_id uuid,
  p_event_id uuid default null,
  p_team_id uuid default null,
  p_player_id uuid default null,
  p_event_type text default null,
  p_minute integer default 0,
  p_event_subtype text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_old public.match_events%rowtype;
  v_event_id uuid;
  v_home_delta integer := 0;
  v_away_delta integer := 0;
  v_old_score_side text;
  v_new_score_side text;
begin
  if (select auth.uid()) is distinct from '674ed5de-14c3-47db-b88f-68cb5f50005d'::uuid then
    raise exception 'forbidden';
  end if;
  if p_event_type not in ('goal','yellow_card','red_card') then
    raise exception 'unsupported_event_type';
  end if;
  if p_minute is null or p_minute < 0 or p_minute > 180 then
    raise exception 'invalid_minute';
  end if;

  select * into v_match from public.matches
  where id=p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if lower(coalesce(v_match.status,'')) <> 'live' then
    raise exception 'match_not_live';
  end if;
  if p_team_id is null or p_team_id not in (v_match.home_team_id,v_match.away_team_id) then
    raise exception 'invalid_team';
  end if;
  if p_player_id is null or not exists(
    select 1 from public.players p
    where p.id=p_player_id and p.team_id=p_team_id
      and p.tournament_id=v_match.tournament_id and coalesce(p.is_active,true)
  ) then
    raise exception 'invalid_player';
  end if;

  if p_event_id is not null then
    select * into v_old from public.match_events
    where id=p_event_id and match_id=p_match_id for update;
    if not found then raise exception 'event_not_found'; end if;
    if v_old.event_type='goal' then
      v_old_score_side := case
        when v_old.event_subtype='own_goal' and v_old.team_id=v_match.home_team_id then 'away'
        when v_old.event_subtype='own_goal' then 'home'
        when v_old.team_id=v_match.home_team_id then 'home'
        else 'away'
      end;
    end if;
  end if;

  if p_event_type='goal' then
    v_new_score_side := case
      when p_event_subtype='own_goal' and p_team_id=v_match.home_team_id then 'away'
      when p_event_subtype='own_goal' then 'home'
      when p_team_id=v_match.home_team_id then 'home'
      else 'away'
    end;
  end if;

  if v_old_score_side='home' then v_home_delta:=v_home_delta-1; end if;
  if v_old_score_side='away' then v_away_delta:=v_away_delta-1; end if;
  if v_new_score_side='home' then v_home_delta:=v_home_delta+1; end if;
  if v_new_score_side='away' then v_away_delta:=v_away_delta+1; end if;

  if p_event_id is null then
    insert into public.match_events(match_id,tournament_id,team_id,player_id,event_type,minute,event_subtype)
    values(p_match_id,v_match.tournament_id,p_team_id,p_player_id,p_event_type,p_minute,p_event_subtype)
    returning id into v_event_id;
  else
    update public.match_events set
      team_id=p_team_id,player_id=p_player_id,event_type=p_event_type,
      minute=p_minute,event_subtype=p_event_subtype
    where id=p_event_id
    returning id into v_event_id;
  end if;

  if v_home_delta<>0 or v_away_delta<>0 then
    update public.matches set
      home_score=greatest(0,coalesce(home_score,0)+v_home_delta),
      away_score=greatest(0,coalesce(away_score,0)+v_away_delta)
    where id=p_match_id
    returning home_score,away_score into v_match.home_score,v_match.away_score;
  else
    v_match.home_score:=coalesce(v_match.home_score,0);
    v_match.away_score:=coalesce(v_match.away_score,0);
  end if;

  return jsonb_build_object(
    'event_id',v_event_id,
    'home_score',v_match.home_score,
    'away_score',v_match.away_score
  );
end;
$$;

create or replace function public.delete_live_match_event_admin(p_match_id uuid,p_event_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_event public.match_events%rowtype;
  v_score_side text;
begin
  if (select auth.uid()) is distinct from '674ed5de-14c3-47db-b88f-68cb5f50005d'::uuid then
    raise exception 'forbidden';
  end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if lower(coalesce(v_match.status,'')) <> 'live' then raise exception 'match_not_live'; end if;
  select * into v_event from public.match_events where id=p_event_id and match_id=p_match_id for update;
  if not found then raise exception 'event_not_found'; end if;

  if v_event.event_type='goal' then
    v_score_side := case
      when v_event.event_subtype='own_goal' and v_event.team_id=v_match.home_team_id then 'away'
      when v_event.event_subtype='own_goal' then 'home'
      when v_event.team_id=v_match.home_team_id then 'home'
      else 'away'
    end;
  end if;
  delete from public.match_events where id=p_event_id;
  if v_score_side='home' then
    update public.matches set home_score=greatest(0,coalesce(home_score,0)-1) where id=p_match_id;
  elsif v_score_side='away' then
    update public.matches set away_score=greatest(0,coalesce(away_score,0)-1) where id=p_match_id;
  end if;
  select * into v_match from public.matches where id=p_match_id;
  return jsonb_build_object('deleted',true,'home_score',coalesce(v_match.home_score,0),'away_score',coalesce(v_match.away_score,0));
end;
$$;

create or replace function public.set_live_match_status_admin(
  p_match_id uuid,
  p_status text,
  p_half_length_minutes integer default 20
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_home_name text;
  v_away_name text;
  v_text text;
begin
  if (select auth.uid()) is distinct from '674ed5de-14c3-47db-b88f-68cb5f50005d'::uuid then
    raise exception 'forbidden';
  end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if p_status='live' and lower(coalesce(v_match.status,''))<>'scheduled' then raise exception 'invalid_status_transition'; end if;
  if p_status='completed' and lower(coalesce(v_match.status,''))<>'live' then raise exception 'invalid_status_transition'; end if;
  if p_status not in ('live','completed') then raise exception 'unsupported_status'; end if;

  select coalesce(name_ar,name,'الفريق الأول') into v_home_name from public.teams where id=v_match.home_team_id;
  select coalesce(name_ar,name,'الفريق الثاني') into v_away_name from public.teams where id=v_match.away_team_id;

  if p_status='live' then
    update public.matches set
      status='live',live_status='live',home_score=coalesce(home_score,0),away_score=coalesce(away_score,0),
      live_started_at=now(),phase_started_at=now(),current_half=1,is_paused=false,
      half_length_minutes=greatest(1,least(coalesce(p_half_length_minutes,20),90)),
      clock_running=true,period_start_at=now(),current_period='first_half'
    where id=p_match_id
    returning * into v_match;
    v_text:='🟢 بدأت مباراة '||v_home_name||' × '||v_away_name;
  else
    update public.matches set
      status='completed',live_status='none',var_team_id=null,is_paused=false,
      clock_running=false,period_start_at=null,current_period='full_time'
    where id=p_match_id
    returning * into v_match;
    v_text:='🏁 انتهت المباراة: '||v_home_name||' '||coalesce(v_match.home_score,0)||' - '||coalesce(v_match.away_score,0)||' '||v_away_name;
  end if;

  insert into public.news_items(tournament_id,match_id,title,content)
  values(v_match.tournament_id,p_match_id,left(v_text,80),v_text);

  return jsonb_build_object(
    'status',v_match.status,'home_score',coalesce(v_match.home_score,0),
    'away_score',coalesce(v_match.away_score,0),'live_started_at',v_match.live_started_at,
    'phase_started_at',v_match.phase_started_at,'current_half',v_match.current_half,
    'is_paused',v_match.is_paused,'half_length_minutes',v_match.half_length_minutes,
    'live_status',v_match.live_status
  );
end;
$$;

revoke all on function public.save_live_match_event_admin(uuid,uuid,uuid,uuid,text,integer,text) from public,anon;
revoke all on function public.delete_live_match_event_admin(uuid,uuid) from public,anon;
revoke all on function public.set_live_match_status_admin(uuid,text,integer) from public,anon;
grant execute on function public.save_live_match_event_admin(uuid,uuid,uuid,uuid,text,integer,text) to authenticated;
grant execute on function public.delete_live_match_event_admin(uuid,uuid) to authenticated;
grant execute on function public.set_live_match_status_admin(uuid,text,integer) to authenticated;
