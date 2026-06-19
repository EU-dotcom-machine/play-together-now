
-- 1. Add tags column
ALTER TABLE public.player_reviews
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- 2. Enforce one review per (game, reviewer, reviewee)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'player_reviews_unique_per_game'
  ) THEN
    ALTER TABLE public.player_reviews
      ADD CONSTRAINT player_reviews_unique_per_game
      UNIQUE (game_id, reviewer_id, reviewee_id);
  END IF;
END $$;

-- 3. Award +5 points to the reviewee on each new review
CREATE OR REPLACE FUNCTION public.award_review_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET points = points + 5
   WHERE id = NEW.reviewee_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_review_points ON public.player_reviews;
CREATE TRIGGER trg_award_review_points
AFTER INSERT ON public.player_reviews
FOR EACH ROW EXECUTE FUNCTION public.award_review_points();
