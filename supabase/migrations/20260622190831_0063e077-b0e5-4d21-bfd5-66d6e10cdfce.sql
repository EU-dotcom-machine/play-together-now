
DROP POLICY IF EXISTS "games read all" ON public.games;

CREATE POLICY "games read visible"
ON public.games FOR SELECT
USING (
  -- host always sees own games
  (auth.uid() IS NOT NULL AND host_id = auth.uid())
  OR
  -- confirmed participants always see
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.game_participants gp
    WHERE gp.game_id = games.id
      AND gp.user_id = auth.uid()
      AND gp.status = 'confirmed'
  ))
  OR
  -- public games visible to all authenticated users
  (visibility = 'public' AND auth.uid() IS NOT NULL)
  OR
  -- friends-only: friends of the host
  (visibility = 'friends' AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.requester_id = auth.uid() AND f.addressee_id = games.host_id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = games.host_id)
      )
  ))
  OR
  -- cep/condomínio: same CEP profile
  (visibility = 'cep' AND auth.uid() IS NOT NULL AND cep IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.cep = games.cep
  ))
);
