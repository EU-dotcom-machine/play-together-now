ALTER TABLE public.sports ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.sports ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recalc_sport_ratings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_sport_id uuid;
  old_sport_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT sport_id INTO target_sport_id FROM public.games WHERE id = OLD.game_id;
    IF target_sport_id IS NULL THEN RETURN NULL; END IF;
    UPDATE public.sports
    SET
      avg_rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM public.game_reviews gr JOIN public.games g ON g.id = gr.game_id WHERE g.sport_id = target_sport_id), 0),
      total_reviews = COALESCE((SELECT COUNT(*)::integer FROM public.game_reviews gr JOIN public.games g ON g.id = gr.game_id WHERE g.sport_id = target_sport_id), 0)
    WHERE id = target_sport_id;
    RETURN NULL;
  END IF;

  -- For INSERT and UPDATE use NEW
  SELECT sport_id INTO target_sport_id FROM public.games WHERE id = NEW.game_id;
  IF target_sport_id IS NULL THEN RETURN NULL; END IF;

  -- If UPDATE and game_id changed (unlikely but handle), recalc old sport too
  IF TG_OP = 'UPDATE' AND OLD.game_id IS DISTINCT FROM NEW.game_id THEN
    SELECT sport_id INTO old_sport_id FROM public.games WHERE id = OLD.game_id;
    IF old_sport_id IS NOT NULL THEN
      UPDATE public.sports
      SET
        avg_rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM public.game_reviews gr JOIN public.games g ON g.id = gr.game_id WHERE g.sport_id = old_sport_id), 0),
        total_reviews = COALESCE((SELECT COUNT(*)::integer FROM public.game_reviews gr JOIN public.games g ON g.id = gr.game_id WHERE g.sport_id = old_sport_id), 0)
      WHERE id = old_sport_id;
    END IF;
  END IF;

  UPDATE public.sports
  SET
    avg_rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM public.game_reviews gr JOIN public.games g ON g.id = gr.game_id WHERE g.sport_id = target_sport_id), 0),
    total_reviews = COALESCE((SELECT COUNT(*)::integer FROM public.game_reviews gr JOIN public.games g ON g.id = gr.game_id WHERE g.sport_id = target_sport_id), 0)
  WHERE id = target_sport_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER recalc_sport_ratings_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.game_reviews
FOR EACH ROW
EXECUTE FUNCTION public.recalc_sport_ratings();

-- Backfill existing data
UPDATE public.sports s
SET
  avg_rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM public.game_reviews gr JOIN public.games g ON g.id = gr.game_id WHERE g.sport_id = s.id), 0),
  total_reviews = COALESCE((SELECT COUNT(*)::integer FROM public.game_reviews gr JOIN public.games g ON g.id = gr.game_id WHERE g.sport_id = s.id), 0);