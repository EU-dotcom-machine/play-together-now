
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS instagram text;

DROP POLICY IF EXISTS "Public venues are viewable by authenticated" ON public.venues;
CREATE POLICY "Public venues are viewable by authenticated"
  ON public.venues FOR SELECT
  TO authenticated
  USING (is_public = true);
