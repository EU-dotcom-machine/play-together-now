DROP POLICY IF EXISTS "participants-host-only" ON realtime.messages;

CREATE POLICY "own-notifications-only"
ON realtime.messages FOR SELECT
USING (realtime.topic() = auth.uid()::text);

REVOKE SELECT ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;