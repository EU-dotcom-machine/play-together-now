-- Fix 1: restrict game reviews to confirmed participants or hosts
DROP POLICY IF EXISTS "game_reviews insert by participants" ON public.game_reviews;
CREATE POLICY "game_reviews insert by participants"
ON public.game_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  reviewer_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.game_participants
      WHERE game_id = game_reviews.game_id
        AND user_id = auth.uid()
        AND status = 'confirmed'
    )
    OR EXISTS (
      SELECT 1 FROM public.games
      WHERE id = game_reviews.game_id
        AND host_id = auth.uid()
    )
  )
);

-- Fix 2: restrict player reviews to confirmed participants
DROP POLICY IF EXISTS "player_reviews insert by participants" ON public.player_reviews;
CREATE POLICY "player_reviews insert by participants"
ON public.player_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  reviewer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE game_id = player_reviews.game_id
      AND user_id = auth.uid()
      AND status = 'confirmed'
  )
);

-- Fix 3: prevent direct execution of SECURITY DEFINER trigger functions by app users
REVOKE EXECUTE ON FUNCTION public.protect_points() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_points() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_points_self_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_points_self_update() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.award_urgency_points() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_urgency_points() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_sport_ratings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_sport_ratings() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_game_review() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_game_review() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_player_review() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_player_review() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;