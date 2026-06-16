CREATE OR REPLACE FUNCTION public.protect_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- pg_trigger_depth() = 1 means protect_points is the only
  -- trigger running → direct user API call → block it.
  -- pg_trigger_depth() > 1 means we are nested inside another
  -- trigger (award_urgency_points) → system call → allow it.
  IF NEW.points IS DISTINCT FROM OLD.points AND pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'points can only be updated by the system';
  END IF;
  RETURN NEW;
END;
$function$;