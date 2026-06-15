
-- Fix 1: Prevent self-confirming participation
DROP POLICY IF EXISTS "participants insert self" ON public.game_participants;
CREATE POLICY "participants insert self pending"
ON public.game_participants
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Fix 2: Restrict messages to confirmed participants or host
DROP POLICY IF EXISTS "messages read participants" ON public.messages;
DROP POLICY IF EXISTS "messages insert participants" ON public.messages;

CREATE POLICY "messages select confirmed or host"
ON public.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.game_participants gp
    WHERE gp.game_id = messages.game_id
      AND gp.user_id = auth.uid()
      AND gp.status = 'confirmed'
  )
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = messages.game_id
      AND g.host_id = auth.uid()
  )
);

CREATE POLICY "messages insert confirmed or host"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.game_participants gp
      WHERE gp.game_id = messages.game_id
        AND gp.user_id = auth.uid()
        AND gp.status = 'confirmed'
    )
    OR EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = messages.game_id
        AND g.host_id = auth.uid()
    )
  )
);
