REVOKE ALL ON FUNCTION public.recalc_sport_rating(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_all_sport_ratings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_sport_ratings_on_game() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_sport_rating(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalc_all_sport_ratings() TO service_role;