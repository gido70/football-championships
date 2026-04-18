ALTER TABLE teams
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS short_name text,
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS color_primary text,
ADD COLUMN IF NOT EXISTS color_secondary text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS tournament_id bigint,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE teams
ADD CONSTRAINT teams_tournament_id_fkey
FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
ON DELETE SET NULL;
