
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.venue_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  role_at_venue TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX venue_claims_one_pending_per_user
  ON public.venue_claims(venue_id, claimant_id)
  WHERE status = 'pending';
CREATE INDEX venue_claims_venue_idx ON public.venue_claims(venue_id);
CREATE INDEX venue_claims_claimant_idx ON public.venue_claims(claimant_id);

GRANT SELECT, INSERT, UPDATE ON public.venue_claims TO authenticated;
GRANT ALL ON public.venue_claims TO service_role;

ALTER TABLE public.venue_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Claimants can view their own claims"
  ON public.venue_claims FOR SELECT
  TO authenticated
  USING (auth.uid() = claimant_id);

CREATE POLICY "Authenticated can create their own claims"
  ON public.venue_claims FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = claimant_id AND status = 'pending');

CREATE POLICY "Claimants can cancel their pending claims"
  ON public.venue_claims FOR UPDATE
  TO authenticated
  USING (auth.uid() = claimant_id AND status = 'pending')
  WITH CHECK (auth.uid() = claimant_id);

CREATE TRIGGER update_venue_claims_updated_at
  BEFORE UPDATE ON public.venue_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
