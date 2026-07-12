
CREATE OR REPLACE FUNCTION public.on_game_insert_notify_nearby()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
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

  PERFORM net.http_post(
    url := 'https://wizbworxoggkmtyrxudx.supabase.co/functions/v1/notify-nearby-users',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify-nearby-users dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
