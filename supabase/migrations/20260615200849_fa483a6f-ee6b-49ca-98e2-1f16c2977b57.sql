-- FIX 1 & 2: Realtime channel authorization
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat-participants-only"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.games
    WHERE id::text = split_part(realtime.topic(), '-', 2)
      AND host_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE game_id::text = split_part(realtime.topic(), '-', 2)
      AND user_id = (SELECT auth.uid())
      AND status = 'confirmed'
  )
);

CREATE POLICY "participants-host-only"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.games
    WHERE id::text = split_part(realtime.topic(), '-', 2)
      AND host_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE game_id::text = split_part(realtime.topic(), '-', 2)
      AND user_id = (SELECT auth.uid())
  )
);

-- FIX 3: nearby_games uses auth.uid() instead of client-supplied viewer_id
DROP FUNCTION IF EXISTS public.nearby_games(extensions.geography, double precision, uuid);
DROP FUNCTION IF EXISTS public.nearby_games(extensions.geography, double precision);

CREATE OR REPLACE FUNCTION public.nearby_games(user_location extensions.geography, radius_meters double precision DEFAULT 10000)
 RETURNS TABLE(id uuid, title text, starts_at timestamp with time zone, slots_total integer, price_cents integer, urgency public.game_urgency, latitude double precision, longitude double precision, sport_id uuid, venue_id uuid, host_id uuid, status text, visibility text, cep text, distance_meters double precision)
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
      OR (auth.uid() IS NOT NULL AND g.host_id = auth.uid())
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

-- FIX 4: Restrict profiles_public to authenticated users only
REVOKE SELECT ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;