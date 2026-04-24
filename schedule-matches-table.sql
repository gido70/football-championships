CREATE TABLE IF NOT EXISTS matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now()
);

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS round_name text,
ADD COLUMN IF NOT EXISTS group_code text,
ADD COLUMN IF NOT EXISTS match_no integer,
ADD COLUMN IF NOT EXISTS home_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS away_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS match_date date,
ADD COLUMN IF NOT EXISTS match_time time,
ADD COLUMN IF NOT EXISTS venue text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS home_score integer,
ADD COLUMN IF NOT EXISTS away_score integer,
ADD COLUMN IF NOT EXISTS notes text;
