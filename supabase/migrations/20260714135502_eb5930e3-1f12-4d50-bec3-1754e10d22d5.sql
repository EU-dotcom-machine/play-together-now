DROP POLICY IF EXISTS "Messages readable by host or confirmed participants" ON public.messages;
DROP POLICY IF EXISTS "Restrict message access to game participants or hosts" ON public.messages;

CREATE POLICY "Messages readable by host or participants"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.game_participants gp
    WHERE gp.game_id = messages.game_id
      AND gp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = messages.game_id
      AND g.host_id = auth.uid()
  )
);