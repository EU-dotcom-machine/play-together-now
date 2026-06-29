
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.user_sport_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sport_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sport_preferences TO authenticated;
GRANT ALL ON public.user_sport_preferences TO service_role;

ALTER TABLE public.user_sport_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usp_select_own" ON public.user_sport_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "usp_insert_own" ON public.user_sport_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "usp_delete_own" ON public.user_sport_preferences
  FOR DELETE TO authenticated USING (user_id = auth.uid());
