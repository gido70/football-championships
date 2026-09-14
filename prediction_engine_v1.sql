-- Source-controlled definition for the isolated prediction package.
-- The live database migrations were applied through Supabase migration history.
alter table public.prediction_rounds
  add column if not exists winner_points integer not null default 2 check (winner_points between 0 and 50),
  add column if not exists exact_bonus integer not null default 2 check (exact_bonus between 0 and 50),
  add column if not exists lock_minutes integer not null default 5 check (lock_minutes between 0 and 1440);
alter table public.participant_predictions add column if not exists predicted_winner_team_id uuid references public.teams(id);
alter table public.prediction_fixtures add column if not exists result_winner_team_id uuid references public.teams(id);
