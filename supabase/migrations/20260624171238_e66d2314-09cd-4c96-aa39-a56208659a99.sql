CREATE OR REPLACE FUNCTION public.block_join_after_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  g RECORD;
  effective_end timestamptz;
BEGIN
  SELECT starts_at, ends_at, duration_min, host_id
    INTO g
    FROM public.games
   WHERE id = NEW.game_id;

  IF g IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF NEW.user_id = g.host_id THEN
    RETURN NEW;
  END IF;

  effective_end := COALESCE(
    g.ends_at,
    g.starts_at + (COALESCE(g.duration_min, 0) || ' minutes')::interval
  );

  IF effective_end <= now() OR g.starts_at <= now() THEN
    RAISE EXCEPTION 'Inscrições encerradas';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_join_after_end ON public.game_participants;
CREATE TRIGGER trg_block_join_after_end
  BEFORE INSERT OR UPDATE OF status ON public.game_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.block_join_after_end();