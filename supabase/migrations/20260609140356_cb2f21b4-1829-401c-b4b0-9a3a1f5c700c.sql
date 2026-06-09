
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,2),
  ADD COLUMN IF NOT EXISTS years_playing text,
  ADD COLUMN IF NOT EXISTS dominant_side text,
  ADD COLUMN IF NOT EXISTS skill_level text,
  ADD COLUMN IF NOT EXISTS sport_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS sport_positions jsonb NOT NULL DEFAULT '{}'::jsonb;
