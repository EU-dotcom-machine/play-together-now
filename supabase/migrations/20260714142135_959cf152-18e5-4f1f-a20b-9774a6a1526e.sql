-- Reinforce games UPDATE policy: only host can update, and cannot reassign host_id
DROP POLICY IF EXISTS "games update own" ON public.games;

CREATE POLICY "games update own"
  ON public.games
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- Trigger to prevent host_id from being changed after creation (locks visibility control to original host)
CREATE OR REPLACE FUNCTION public.prevent_game_host_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.host_id IS DISTINCT FROM OLD.host_id THEN
    RAISE EXCEPTION 'host_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_game_host_change ON public.games;
CREATE TRIGGER trg_prevent_game_host_change
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_game_host_change();