CREATE OR REPLACE FUNCTION public.protect_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.points IS DISTINCT FROM OLD.points AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'points can only be updated by the system';
  END IF;
  RETURN NEW;
END;
$function$;