UPDATE public.profiles
   SET onboarding_completed = true
 WHERE created_at < '2026-06-30'::timestamptz
   AND onboarding_completed IS DISTINCT FROM true;