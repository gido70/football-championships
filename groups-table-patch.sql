ALTER TABLE teams
ADD COLUMN IF NOT EXISTS group_code text,
ADD COLUMN IF NOT EXISTS group_seed integer;
