
-- Reviews for the game itself (and by extension the sport)
CREATE TABLE public.game_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  rating smallint NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, reviewer_id)
);

-- Reviews for individual players in a given game
CREATE TABLE public.player_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  reviewee_id uuid NOT NULL,
  rating smallint NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, reviewer_id, reviewee_id),
  CHECK (reviewer_id <> reviewee_id)
);

-- Range validation via trigger (CHECKs with simple range are ok, but keep aligned)
ALTER TABLE public.game_reviews ADD CONSTRAINT game_reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE public.player_reviews ADD CONSTRAINT player_reviews_rating_range CHECK (rating BETWEEN 1 AND 5);

-- Validate: reviewer must be a participant and game must have started (ended-ish)
CREATE OR REPLACE FUNCTION public.validate_game_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g RECORD;
BEGIN
  SELECT starts_at, duration_min INTO g FROM public.games WHERE id = NEW.game_id;
  IF g IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF (g.starts_at + (g.duration_min || ' minutes')::interval) > now() THEN
    RAISE EXCEPTION 'Reviews só após o jogo terminar';
  END IF;
  IF NOT public.is_game_participant(NEW.game_id, NEW.reviewer_id) THEN
    RAISE EXCEPTION 'Só participantes podem avaliar';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_player_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g RECORD;
BEGIN
  SELECT starts_at, duration_min INTO g FROM public.games WHERE id = NEW.game_id;
  IF g IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF (g.starts_at + (g.duration_min || ' minutes')::interval) > now() THEN
    RAISE EXCEPTION 'Reviews só após o jogo terminar';
  END IF;
  IF NOT public.is_game_participant(NEW.game_id, NEW.reviewer_id) THEN
    RAISE EXCEPTION 'Só participantes podem avaliar';
  END IF;
  IF NOT public.is_game_participant(NEW.game_id, NEW.reviewee_id) THEN
    RAISE EXCEPTION 'Avaliado não estava no jogo';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_game_review BEFORE INSERT OR UPDATE ON public.game_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_game_review();
CREATE TRIGGER trg_validate_player_review BEFORE INSERT OR UPDATE ON public.player_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_player_review();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_reviews TO authenticated;
GRANT ALL ON public.game_reviews TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_reviews TO authenticated;
GRANT ALL ON public.player_reviews TO service_role;

ALTER TABLE public.game_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_reviews read all" ON public.game_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "game_reviews insert own" ON public.game_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "game_reviews update own" ON public.game_reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "game_reviews delete own" ON public.game_reviews FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);

CREATE POLICY "player_reviews read all" ON public.player_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "player_reviews insert own" ON public.player_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "player_reviews update own" ON public.player_reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "player_reviews delete own" ON public.player_reviews FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);
