
CREATE OR REPLACE FUNCTION public.is_game_participant(_game_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_participants WHERE game_id = _game_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.games WHERE id = _game_id AND host_id = _user_id
  );
$$;
