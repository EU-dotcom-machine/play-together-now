-- Consistent sport ratings: ensure cached avg_rating / total_reviews on public.sports
-- always reflect public.game_reviews, and reconcile any drift.

-- 1) Tighten the cached columns so the UI never sees NULL divergence.
UPDATE public.sports SET avg_rating = 0 WHERE avg_rating IS NULL;
UPDATE public.sports SET total_reviews = 0 WHERE total_reviews IS NULL;
ALTER TABLE public.sports
  ALTER COLUMN avg_rating SET DEFAULT 0,
  ALTER COLUMN avg_rating SET NOT NULL,
  ALTER COLUMN total_reviews SET DEFAULT 0,
  ALTER COLUMN total_reviews SET NOT NULL;

-- 2) Single source of truth: recalc one sport from game_reviews JOIN games.
CREATE OR REPLACE FUNCTION public.recalc_sport_rating(_sport_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sports s
     SET avg_rating = COALESCE(agg.avg, 0)::numeric(3,2),
         total_reviews = COALESCE(agg.cnt, 0)::int
    FROM (
      SELECT AVG(gr.rating)::numeric(10,4) AS avg, COUNT(*)::int AS cnt
        FROM public.game_reviews gr
        JOIN public.games g ON g.id = gr.game_id
       WHERE g.sport_id = _sport_id
    ) agg
   WHERE s.id = _sport_id;
$$;

-- 3) Recalc-all helper for periodic reconciliation / backfills.
CREATE OR REPLACE FUNCTION public.recalc_all_sport_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.sports LOOP
    PERFORM public.recalc_sport_rating(r.id);
  END LOOP;
END $$;

-- 4) Rewrite the game_reviews trigger to delegate to recalc_sport_rating.
--    Existing trigger already exists; replace the function body.
CREATE OR REPLACE FUNCTION public.recalc_sport_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_sport uuid;
  old_sport uuid;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT sport_id INTO new_sport FROM public.games WHERE id = NEW.game_id;
    IF new_sport IS NOT NULL THEN PERFORM public.recalc_sport_rating(new_sport); END IF;
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT sport_id INTO old_sport FROM public.games
     WHERE id = COALESCE(OLD.game_id, NEW.game_id);
    IF old_sport IS NOT NULL AND old_sport IS DISTINCT FROM new_sport THEN
      PERFORM public.recalc_sport_rating(old_sport);
    END IF;
  END IF;
  RETURN NULL;
END $$;

-- 5) Keep counts correct when a game's sport changes or a game is deleted
--    (game_reviews rows cascade away but their sport contribution must be removed).
CREATE OR REPLACE FUNCTION public.recalc_sport_ratings_on_game()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.sport_id IS DISTINCT FROM OLD.sport_id THEN
    PERFORM public.recalc_sport_rating(OLD.sport_id);
    PERFORM public.recalc_sport_rating(NEW.sport_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_sport_rating(OLD.sport_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_recalc_sport_on_game ON public.games;
CREATE TRIGGER trg_recalc_sport_on_game
AFTER UPDATE OF sport_id OR DELETE ON public.games
FOR EACH ROW EXECUTE FUNCTION public.recalc_sport_ratings_on_game();

-- 6) Backfill: reconcile every sport now so cached values match reality.
SELECT public.recalc_all_sport_ratings();