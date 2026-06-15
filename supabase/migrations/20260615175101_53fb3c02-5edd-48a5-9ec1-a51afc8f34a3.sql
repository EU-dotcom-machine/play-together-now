-- Drop the redundant INSERT policies that bypass the new participation checks
DROP POLICY IF EXISTS "game_reviews insert own" ON public.game_reviews;
DROP POLICY IF EXISTS "player_reviews insert own" ON public.player_reviews;

-- Revoke direct EXECUTE from anon on all SECURITY DEFINER trigger functions
-- (the explicit anon grant on protect_points was the remaining linter warning)
REVOKE EXECUTE ON FUNCTION public.protect_points() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_points_self_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.award_urgency_points() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalc_sport_ratings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_game_review() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_player_review() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;