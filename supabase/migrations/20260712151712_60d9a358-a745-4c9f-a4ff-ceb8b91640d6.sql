
-- Helper RPC: find users near a point who prefer a given sport, excluding a user.
CREATE OR REPLACE FUNCTION public.nearby_users_for_sport(
  _lat double precision,
  _lng double precision,
  _sport_id uuid,
  _exclude_user uuid,
  _radius_meters double precision DEFAULT 20000
)
RETURNS TABLE(user_id uuid, distance_meters double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    p.id AS user_id,
    extensions.ST_Distance(
      extensions.ST_MakePoint(p.longitude, p.latitude)::extensions.geography,
      extensions.ST_MakePoint(_lng, _lat)::extensions.geography
    ) AS distance_meters
  FROM public.profiles p
  JOIN public.user_sport_preferences usp
    ON usp.user_id = p.id AND usp.sport_id = _sport_id
  WHERE p.id <> _exclude_user
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND extensions.ST_DWithin(
      extensions.ST_MakePoint(p.longitude, p.latitude)::extensions.geography,
      extensions.ST_MakePoint(_lng, _lat)::extensions.geography,
      _radius_meters
    );
$$;

REVOKE ALL ON FUNCTION public.nearby_users_for_sport(double precision, double precision, uuid, uuid, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nearby_users_for_sport(double precision, double precision, uuid, uuid, double precision) TO service_role;

-- Ensure pg_net is available for the outbound HTTP call.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: POST the new game row to the edge function.
CREATE OR REPLACE FUNCTION public.on_game_insert_notify_nearby()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'games',
    'schema', 'public',
    'record', jsonb_build_object(
      'id', NEW.id,
      'host_id', NEW.host_id,
      'sport_id', NEW.sport_id,
      'title', NEW.title,
      'starts_at', NEW.starts_at,
      'latitude', NEW.latitude,
      'longitude', NEW.longitude
    ),
    'old_record', NULL
  );

  PERFORM extensions.http_post(
    url := 'https://wizbworxoggkmtyrxudx.supabase.co/functions/v1/notify-nearby-users',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block game creation on notification delivery.
  RAISE WARNING 'notify-nearby-users dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_games_notify_nearby ON public.games;
CREATE TRIGGER trg_games_notify_nearby
AFTER INSERT ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.on_game_insert_notify_nearby();
