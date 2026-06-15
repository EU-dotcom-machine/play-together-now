
CREATE OR REPLACE FUNCTION public.prevent_points_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.points IS DISTINCT FROM OLD.points
     AND current_setting('role', true) <> 'service_role' THEN
    NEW.points := OLD.points;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_points_self_update ON public.profiles;
CREATE TRIGGER profiles_prevent_points_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_points_self_update();
