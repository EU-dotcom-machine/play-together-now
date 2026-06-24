ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS venue_type text NOT NULL DEFAULT 'personal'
  CHECK (venue_type IN ('personal','establishment'));
CREATE INDEX IF NOT EXISTS venues_venue_type_idx ON public.venues(venue_type);