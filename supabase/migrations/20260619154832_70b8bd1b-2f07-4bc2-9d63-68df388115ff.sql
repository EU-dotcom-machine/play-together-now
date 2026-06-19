REVOKE SELECT ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;