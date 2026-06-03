
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_urgency_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_game_participant(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_game_participant(UUID, UUID) TO authenticated;
