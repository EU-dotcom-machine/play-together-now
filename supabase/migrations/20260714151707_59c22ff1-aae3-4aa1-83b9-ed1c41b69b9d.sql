CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_subscription jsonb,
  p_endpoint text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, subscription, endpoint)
  VALUES (auth.uid(), p_subscription, p_endpoint)
  ON CONFLICT (endpoint) DO UPDATE
    SET subscription = EXCLUDED.subscription,
        user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_push_subscription(jsonb, text) TO authenticated;