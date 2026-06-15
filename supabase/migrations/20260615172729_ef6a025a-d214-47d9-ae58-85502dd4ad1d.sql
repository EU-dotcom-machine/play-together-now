
-- FIX 1: Protect points column on profiles
CREATE OR REPLACE FUNCTION public.protect_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.points IS DISTINCT FROM OLD.points
     AND current_setting('role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'points can only be updated by the system';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_points_protection ON public.profiles;
CREATE TRIGGER enforce_points_protection
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_points();

-- Remove the older permissive helper trigger function (if not attached) - keep coexisting safely.
-- (no-op if missing)

-- FIX 2: Restrict sensitive profile fields
DROP POLICY IF EXISTS "profiles viewable by authenticated" ON public.profiles;

-- Only owners can SELECT from the base profiles table (which contains sensitive fields)
CREATE POLICY "profiles owner select"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Public-safe view exposing only non-sensitive columns; runs with definer rights so it bypasses base table RLS
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT
  id,
  display_name,
  avatar_url,
  bio,
  points,
  sponsor_brand,
  sport_ids,
  skill_level
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;
