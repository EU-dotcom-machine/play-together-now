ALTER TABLE player_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_reviews insert by participants" ON player_reviews;
DROP POLICY IF EXISTS "player_reviews read all" ON player_reviews;
DROP POLICY IF EXISTS "authenticated users can insert own reviews" ON player_reviews;
DROP POLICY IF EXISTS "users can read own reviews" ON player_reviews;

CREATE POLICY "authenticated users can insert own reviews"
  ON player_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "users can read own reviews"
  ON player_reviews FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid());