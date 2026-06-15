
-- Add columns
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','friends','cep')),
  ADD COLUMN IF NOT EXISTS cep text NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cep text NULL;

-- Replace nearby_games to accept viewer + apply visibility filters
DROP FUNCTION IF EXISTS public.nearby_games(extensions.geography, double precision);

CREATE OR REPLACE FUNCTION public.nearby_games(
  user_location extensions.geography,
  radius_meters double precision DEFAULT 10000,
  viewer_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  title text,
  starts_at timestamp with time zone,
  slots_total integer,
  price_cents integer,
  urgency game_urgency,
  latitude double precision,
  longitude double precision,
  sport_id uuid,
  venue_id uuid,
  host_id uuid,
  status text,
  visibility text,
  cep text,
  distance_meters double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT
    g.id, g.title, g.starts_at, g.slots_total, g.price_cents, g.urgency,
    g.latitude, g.longitude, g.sport_id, g.venue_id, g.host_id, g.status,
    g.visibility, g.cep,
    extensions.ST_Distance(g.location, user_location) AS distance_meters
  FROM public.games g
  WHERE g.status = 'open'
    AND g.starts_at > now()
    AND extensions.ST_DWithin(g.location, user_location, radius_meters)
    AND (
      g.visibility = 'public'
      OR (viewer_id IS NOT NULL AND g.host_id = viewer_id)
      OR (
        g.visibility = 'friends'
        AND viewer_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.status = 'accepted'
            AND (
              (f.requester_id = viewer_id AND f.addressee_id = g.host_id)
              OR (f.addressee_id = viewer_id AND f.requester_id = g.host_id)
            )
        )
      )
      OR (
        g.visibility = 'cep'
        AND viewer_id IS NOT NULL
        AND g.cep IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = viewer_id AND p.cep = g.cep
        )
      )
    )
  ORDER BY extensions.ST_Distance(g.location, user_location) ASC;
$function$;
