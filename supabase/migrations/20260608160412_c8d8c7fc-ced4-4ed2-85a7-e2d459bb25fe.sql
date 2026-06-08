-- Enable PostGIS in dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Make sure roles can resolve postgis types/functions
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- Add a generated geography column for games derived from lat/lng
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS geog extensions.geography(Point, 4326)
  GENERATED ALWAYS AS (
    extensions.ST_SetSRID(extensions.ST_MakePoint(longitude, latitude), 4326)::extensions.geography
  ) STORED;

-- Spatial index for fast radius queries
CREATE INDEX IF NOT EXISTS games_geog_gix ON public.games USING gist (geog);

-- nearby_games(center, radius_m): returns upcoming open games within radius
CREATE OR REPLACE FUNCTION public.nearby_games(
  center extensions.geography,
  radius_m double precision DEFAULT 10000
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
  distance_m double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
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
    extensions.ST_Distance(g.geog, center) AS distance_m
  FROM public.games g
  WHERE g.starts_at >= now() - interval '1 hour'
    AND extensions.ST_DWithin(g.geog, center, radius_m)
  ORDER BY g.geog <-> center;
$$;

GRANT EXECUTE ON FUNCTION public.nearby_games(extensions.geography, double precision)
  TO anon, authenticated, service_role;