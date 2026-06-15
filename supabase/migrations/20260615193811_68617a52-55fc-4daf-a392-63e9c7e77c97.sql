DROP POLICY IF EXISTS "Messages are viewable by sender, participants, or host" ON public.messages;

CREATE POLICY "Messages readable by host or confirmed participants" ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.games
    WHERE games.id = messages.game_id
      AND games.host_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE game_participants.game_id = messages.game_id
      AND game_participants.user_id = auth.uid()
      AND game_participants.status = 'confirmed'
  )
);