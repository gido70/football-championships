-- Source-controlled definition for the isolated prediction package.
-- The live database migrations were applied through Supabase migration history.
alter table public.prediction_rounds
  add column if not exists winner_points integer not null default 2 check (winner_points between 0 and 50),
  add column if not exists exact_bonus integer not null default 2 check (exact_bonus between 0 and 50),
  add column if not exists lock_minutes integer not null default 0 check (lock_minutes between 0 and 1440);
alter table public.participant_predictions add column if not exists predicted_winner_team_id uuid references public.teams(id);
alter table public.prediction_fixtures
  add column if not exists result_winner_team_id uuid references public.teams(id),
  add column if not exists is_locked boolean not null default false;

-- قواعد النقاط حسب مرحلة خروج المغلوب:
-- دور الـ16: نقطتان للفائز فقط. من ربع النهائي: نقطتان للفائز + نقطتان للنتيجة الدقيقة.
create schema if not exists private;
create or replace function private.enforce_prediction_round_scoring()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare v_stage text := lower(coalesce(new.stage_code,''));
begin
  if v_stage in ('round_of_16','round-of-16','last_16','r16') then
    new.winner_points := 2;
    new.exact_bonus := 0;
  elsif v_stage in (
    'quarterfinal','quarter_final','quarter-final','qf',
    'semifinal','semi_final','semi-final','sf',
    'third_place','third-place','bronze','final','f'
  ) then
    new.winner_points := 2;
    new.exact_bonus := 2;
  end if;
  return new;
end
$$;
revoke all on function private.enforce_prediction_round_scoring() from public, anon, authenticated;
drop trigger if exists trg_enforce_prediction_round_scoring on public.prediction_rounds;
create trigger trg_enforce_prediction_round_scoring
before insert or update of stage_code, winner_points, exact_bonus on public.prediction_rounds
for each row execute function private.enforce_prediction_round_scoring();
