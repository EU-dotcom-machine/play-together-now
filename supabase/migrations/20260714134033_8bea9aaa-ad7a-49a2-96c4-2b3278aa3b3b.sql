CREATE OR REPLACE FUNCTION public.on_game_insert_notify_nearby()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net', 'extensions'
AS $function$
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpemJ3b3J4b2dna210eXJ4dWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTY2MDksImV4cCI6MjA5NjA3MjYwOX0.eB-BCC2BD96a6Cf-UT48Ji7x0F_xRsptiBxmLFp3dWc'
    ),
    body := payload,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify-nearby-users dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;