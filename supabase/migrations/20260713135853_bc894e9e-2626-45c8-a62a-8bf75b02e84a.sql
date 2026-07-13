GRANT UPDATE ON public.push_subscriptions TO authenticated;
CREATE POLICY "own push subs update" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);