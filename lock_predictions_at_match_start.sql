-- Close each prediction at scheduled kickoff or immediately when the match is started.
alter table public.prediction_fixtures
  add column if not exists is_locked boolean not null default false;

update public.prediction_sync_settings set lock_minutes=0,updated_at=now()
where tournament_id in(
  'eee33333-5d2a-4f3b-a981-d4b8f5f86143'::uuid,
  'c983ee0c-4434-470d-b0a2-6e6efe1ad650'::uuid
);
update public.prediction_rounds set lock_minutes=0
where tournament_id in(
  'eee33333-5d2a-4f3b-a981-d4b8f5f86143'::uuid,
  'c983ee0c-4434-470d-b0a2-6e6efe1ad650'::uuid
);

-- The deployed private.sync_match_to_predictions() writes is_locked=true when
-- matches.status becomes live/completed/finished/ended, and false while scheduled.

drop policy if exists predictions_self_insert on public.participant_predictions;
create policy predictions_self_insert on public.participant_predictions
for insert to authenticated
with check(
  (select auth.uid())=participant_id and exists(
    select 1 from public.prediction_fixtures f
    join public.prediction_rounds r on r.id=f.round_id
    join public.participant_tournament_memberships m on m.tournament_id=r.tournament_id
    where f.id=participant_predictions.fixture_id
      and m.participant_id=(select auth.uid())
      and not f.is_scored and not f.is_locked
      and r.status='open' and now()>=r.opens_at
      and now()<least(r.closes_at,f.kickoff_at-(r.lock_minutes*interval '1 minute'))
      and(
        participant_predictions.predicted_winner_team_id is null
        or participant_predictions.predicted_winner_team_id in(f.home_team_id,f.away_team_id)
      )
  )
);

drop policy if exists predictions_self_update on public.participant_predictions;
create policy predictions_self_update on public.participant_predictions
for update to authenticated
using((select auth.uid())=participant_id)
with check(
  (select auth.uid())=participant_id and exists(
    select 1 from public.prediction_fixtures f
    join public.prediction_rounds r on r.id=f.round_id
    where f.id=participant_predictions.fixture_id
      and not f.is_scored and not f.is_locked
      and r.status='open' and now()>=r.opens_at
      and now()<least(r.closes_at,f.kickoff_at-(r.lock_minutes*interval '1 minute'))
      and(
        participant_predictions.predicted_winner_team_id is null
        or participant_predictions.predicted_winner_team_id in(f.home_team_id,f.away_team_id)
      )
  )
);
