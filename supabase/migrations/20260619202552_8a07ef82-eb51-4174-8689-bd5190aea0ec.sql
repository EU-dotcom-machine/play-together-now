ALTER TABLE public.games ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 120;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS ends_at timestamptz;
UPDATE public.games SET ends_at = starts_at + (duration_minutes || ' minutes')::interval WHERE ends_at IS NULL;