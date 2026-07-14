
-- 1. Extend the visibility CHECK to allow 'private' (keep 'cep' for the existing condomínio feature)
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_visibility_check;
ALTER TABLE public.games
  ADD CONSTRAINT games_visibility_check
  CHECK (visibility IN ('public', 'friends', 'cep', 'private'));

-- 2. Update nearby_games so 'private' games never appear in discovery
CREATE OR REPLACE FUNCTION public.nearby_games(user_location extensions.geography, radius_meters double precision DEFAULT 10000)
 RETURNS TABLE(id uuid, title text, starts_at timestamp with time zone, slots_total integer, price_cents integer, urgency game_urgency, latitude double precision, longitude double precision, sport_id uuid, venue_id uuid, host_id uuid, status text, visibility text, cep text, distance_meters double precision)
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
  WHERE g.status IN ('open','full')
    AND g.starts_at > (now() - interval '3 hours')
    AND extensions.ST_DWithin(g.location, user_location, radius_meters)
    AND (
      -- Host and confirmed participants always see their own games (including private)
      (auth.uid() IS NOT NULL AND g.host_id = auth.uid())
      OR (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.game_participants gp
          WHERE gp.game_id = g.id
            AND gp.user_id = auth.uid()
            AND gp.status = 'confirmed'
        )
      )
      -- Otherwise apply visibility rules; 'private' is intentionally omitted so it never appears
      OR g.visibility = 'public'
      OR (
        g.visibility = 'friends'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.status = 'accepted'
            AND (
              (f.requester_id = auth.uid() AND f.addressee_id = g.host_id)
              OR (f.addressee_id = auth.uid() AND f.requester_id = g.host_id)
            )
        )
      )
      OR (
        g.visibility = 'cep'
        AND auth.uid() IS NOT NULL
        AND g.cep IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.cep = g.cep
        )
      )
    )
  ORDER BY extensions.ST_Distance(g.location, user_location) ASC;
$function$;
