-- Fix red-card and own-goal news generation for the current players schema.
-- The players table uses full_name_ar, not name_ar.
create or replace function public.auto_highlight_events()
returns trigger
language plpgsql
as $function$
declare
  auto_on boolean;
  t1 text;
  t2 text;
  pname text;
  tname text;
begin
  select coalesce(auto_news_enabled, true)
    into auto_on
    from public.tournaments
   where id = NEW.tournament_id;

  if not auto_on then
    return NEW;
  end if;

  if NEW.event_type = 'red_card' or NEW.event_subtype = 'own_goal' then
    select coalesce(full_name_ar, name)
      into pname
      from public.players
     where id = NEW.player_id;

    select coalesce(name_ar, name)
      into tname
      from public.teams
     where id = NEW.team_id;

    select coalesce(t1t.name_ar, t1t.name), coalesce(t2t.name_ar, t2t.name)
      into t1, t2
      from public.matches m
      left join public.teams t1t on t1t.id = coalesce(m.team1_id, m.home_team_id)
      left join public.teams t2t on t2t.id = coalesce(m.team2_id, m.away_team_id)
     where m.id = NEW.match_id;

    if NEW.event_type = 'red_card' then
      insert into public.news_items(tournament_id, title, content, match_id, published_at, is_active)
      values (
        NEW.tournament_id,
        '🟥 حدث مهم: طرد ' || coalesce(pname, 'لاعب') || ' في مباراة ' || coalesce(t1, '') || ' × ' || coalesce(t2, ''),
        '🟥 حدث مهم: طرد ' || coalesce(pname, 'لاعب') || ' (' || coalesce(tname, '') || ') في مباراة ' || coalesce(t1, '') || ' × ' || coalesce(t2, ''),
        NEW.match_id,
        now(),
        true
      );
    elsif NEW.event_subtype = 'own_goal' then
      insert into public.news_items(tournament_id, title, content, match_id, published_at, is_active)
      values (
        NEW.tournament_id,
        '⚠️ هدف عكسي مثير في مباراة ' || coalesce(t1, '') || ' × ' || coalesce(t2, ''),
        '⚠️ هدف عكسي من ' || coalesce(pname, 'لاعب') || ' في مباراة ' || coalesce(t1, '') || ' × ' || coalesce(t2, ''),
        NEW.match_id,
        now(),
        true
      );
    end if;
  end if;

  return NEW;
end;
$function$;
