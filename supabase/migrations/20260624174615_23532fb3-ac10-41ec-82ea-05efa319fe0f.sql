
CREATE OR REPLACE FUNCTION public.get_player_sport_rating(player_id uuid, sport_id uuid)
RETURNS TABLE (
  sport_avg numeric,
  sport_total integer,
  top_tags text[],
  overall_avg numeric,
  overall_total integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((
      SELECT AVG(pr.rating)::numeric(3,2)
        FROM public.player_reviews pr
        JOIN public.games g ON g.id = pr.game_id
       WHERE pr.reviewee_id = player_id AND g.sport_id = get_player_sport_rating.sport_id
    ), 0)::numeric AS sport_avg,
    COALESCE((
      SELECT COUNT(*)::int
        FROM public.player_reviews pr
        JOIN public.games g ON g.id = pr.game_id
       WHERE pr.reviewee_id = player_id AND g.sport_id = get_player_sport_rating.sport_id
    ), 0) AS sport_total,
    COALESCE((
      SELECT ARRAY(
        SELECT tag
          FROM (
            SELECT unnest(pr.tags) AS tag
              FROM public.player_reviews pr
              JOIN public.games g ON g.id = pr.game_id
             WHERE pr.reviewee_id = player_id AND g.sport_id = get_player_sport_rating.sport_id
          ) t
         WHERE tag IS NOT NULL AND tag <> ''
         GROUP BY tag
         ORDER BY COUNT(*) DESC, tag ASC
         LIMIT 3
      )
    ), ARRAY[]::text[]) AS top_tags,
    COALESCE((
      SELECT AVG(pr.rating)::numeric(3,2)
        FROM public.player_reviews pr
       WHERE pr.reviewee_id = player_id
    ), 0)::numeric AS overall_avg,
    COALESCE((
      SELECT COUNT(*)::int
        FROM public.player_reviews pr
       WHERE pr.reviewee_id = player_id
    ), 0) AS overall_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_player_sport_rating(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_player_sport_rating(uuid, uuid) TO authenticated, service_role;
