ALTER TABLE public.player_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing insert/select policies to avoid conflicts
DROP POLICY IF EXISTS "player_reviews insert by participants" ON public.player_reviews;
DROP POLICY IF EXISTS "player_reviews read all" ON public.player_reviews;
DROP POLICY IF EXISTS "authenticated users can insert own reviews" ON public.player_reviews;
DROP POLICY IF EXISTS "users can read own reviews" ON public.player_reviews;

-- Allow authenticated users to insert reviews where they are the reviewer
CREATE POLICY "authenticated users can insert own reviews"
  ON public.player_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

-- Allow users to read reviews where they are the reviewer or the reviewed
CREATE POLICY "users can read own reviews"
  ON public.player_reviews FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid());