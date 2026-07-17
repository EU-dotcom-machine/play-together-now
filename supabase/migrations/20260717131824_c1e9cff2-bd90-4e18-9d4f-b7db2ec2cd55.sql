-- Selo verificado no ranking de espaços: get_venue_ranking passa a retornar
-- is_verified. Mudar a assinatura de RETURNS TABLE exige DROP + CREATE.

DROP FUNCTION IF EXISTS public.get_venue_ranking(uuid, date, int);

CREATE FUNCTION public.get_venue_ranking(
  p_sport  uuid  DEFAULT NULL,
  p_season date  DEFAULT NULL,
  p_limit  int   DEFAULT 50
)
RETURNS TABLE(venue_id uuid, name text, address text, points int, is_verified boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.venue_id,
         v.name,
         v.address,
         SUM(r.points)::int AS points,
         bool_or(v.is_verified) AS is_verified
  FROM public.v_venue_points r
  JOIN public.venues v ON v.id = r.venue_id
  WHERE v.is_public = true
    AND (p_sport  IS NULL OR r.sport_id = p_sport)
    AND (p_season IS NULL OR r.season   = p_season)
  GROUP BY r.venue_id, v.name, v.address
  HAVING SUM(r.points) > 0
  ORDER BY points DESC, v.name ASC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.get_venue_ranking(uuid, date, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_ranking(uuid, date, int) TO authenticated;
