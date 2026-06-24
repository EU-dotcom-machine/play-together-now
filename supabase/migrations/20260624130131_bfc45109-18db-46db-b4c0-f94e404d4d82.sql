ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recalc_player_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET avg_rating = COALESCE((SELECT AVG(rating) FROM public.player_reviews WHERE reviewee_id = NEW.reviewee_id), 0)::numeric(3,2),
         total_reviews = COALESCE((SELECT COUNT(*) FROM public.player_reviews WHERE reviewee_id = NEW.reviewee_id), 0)::int
   WHERE id = NEW.reviewee_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_player_rating ON public.player_reviews;
CREATE TRIGGER trg_recalc_player_rating
AFTER INSERT ON public.player_reviews
FOR EACH ROW EXECUTE FUNCTION public.recalc_player_rating();

-- Backfill existing data
UPDATE public.profiles p
   SET avg_rating = COALESCE(agg.avg, 0)::numeric(3,2),
       total_reviews = COALESCE(agg.cnt, 0)::int
  FROM (
    SELECT reviewee_id, AVG(rating) AS avg, COUNT(*) AS cnt
      FROM public.player_reviews
     GROUP BY reviewee_id
  ) agg
 WHERE p.id = agg.reviewee_id;

-- Rebuild profiles_public view to expose new columns
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT
  id,
  display_name,
  avatar_url,
  bio,
  points,
  sponsor_brand,
  sport_ids,
  skill_level,
  avg_rating,
  total_reviews
FROM public.profiles;

REVOKE SELECT ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;
