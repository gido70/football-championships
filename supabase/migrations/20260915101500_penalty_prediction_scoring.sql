alter table public.participant_predictions
  add column if not exists predicts_penalties boolean not null default false,
  add column if not exists predicted_home_penalties integer,
  add column if not exists predicted_away_penalties integer;

alter table public.participant_predictions drop constraint if exists participant_predictions_predicted_home_penalties_check;
alter table public.participant_predictions add constraint participant_predictions_predicted_home_penalties_check check (predicted_home_penalties between 0 and 20);
alter table public.participant_predictions drop constraint if exists participant_predictions_predicted_away_penalties_check;
alter table public.participant_predictions add constraint participant_predictions_predicted_away_penalties_check check (predicted_away_penalties between 0 and 20);

create or replace function private.score_fixture_predictions()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_participant uuid; v_tournament uuid; v_stage text; v_winner_points integer; v_bonus integer; v_hp integer; v_ap integer; v_has_pens boolean;
begin
  select tournament_id,lower(coalesce(stage_code,'')),winner_points,exact_bonus
    into v_tournament,v_stage,v_winner_points,v_bonus
  from public.prediction_rounds where id=new.round_id;
  select home_penalties,away_penalties into v_hp,v_ap from public.matches where id=new.match_id;
  v_has_pens:=v_hp is not null and v_ap is not null and v_hp<>v_ap;
  update public.participant_predictions pr set points=case when not new.is_scored then 0
    when v_stage in ('group','groups','group_stage','group-stage','round_of_16','round-of-16','last_16','r16')
      then case when ((pr.predicted_home>pr.predicted_away and new.result_home>new.result_away)
                       or (pr.predicted_home<pr.predicted_away and new.result_home<new.result_away)
                       or (pr.predicted_home=pr.predicted_away and new.result_home=new.result_away))
                then v_winner_points else 0 end
    else
      (case when pr.predicted_winner_team_id is not null and pr.predicted_winner_team_id=new.result_winner_team_id then v_winner_points else 0 end)
      +(case when pr.predicts_penalties and v_has_pens then v_bonus else 0 end)
      +(case when pr.predicts_penalties and v_has_pens and pr.predicted_home_penalties=v_hp and pr.predicted_away_penalties=v_ap then 2 else 0 end)
    end,updated_at=now()
  where pr.fixture_id=new.id;
  for v_participant in select participant_id from public.participant_predictions where fixture_id=new.id loop
    perform private.refresh_prediction_leaderboard(v_participant,v_tournament);
  end loop;
  return new;
end $$;
revoke all on function private.score_fixture_predictions() from public,anon,authenticated;
