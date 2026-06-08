-- 1. Rename geog -> location, recreate GIST index
ALTER TABLE public.games RENAME COLUMN geog TO location;
DROP INDEX IF EXISTS public.games_geog_gix;
CREATE INDEX IF NOT EXISTS games_location_gix ON public.games USING GIST (location);

-- 2. Add status column (default 'open')
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
CREATE INDEX IF NOT EXISTS games_status_idx ON public.games (status);

-- 3. Recreate nearby_games with the requested signature
DROP FUNCTION IF EXISTS public.nearby_games(extensions.geography, double precision);

CREATE OR REPLACE FUNCTION public.nearby_games(
  user_location extensions.geography,
  radius_meters double precision DEFAULT 10000
)
RETURNS TABLE (
  id uuid,
  title text,
  starts_at timestamptz,
  slots_total integer,
  price_cents integer,
  urgency public.game_urgency,
  latitude double precision,
  longitude double precision,
  sport_id uuid,
  venue_id uuid,
  host_id uuid,
  status text,
  distance_meters double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    g.id,
    g.title,
    g.starts_at,
    g.slots_total,
    g.price_cents,
    g.urgency,
    g.latitude,
    g.longitude,
    g.sport_id,
    g.venue_id,
    g.host_id,
    g.status,
    extensions.ST_Distance(g.location, user_location) AS distance_meters
  FROM public.games g
  WHERE g.status = 'open'
    AND g.starts_at > now()
    AND extensions.ST_DWithin(g.location, user_location, radius_meters)
  ORDER BY extensions.ST_Distance(g.location, user_location) ASC;
$$;

GRANT EXECUTE ON FUNCTION public.nearby_games(extensions.geography, double precision) TO anon, authenticated, service_role;