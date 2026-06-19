-- RLS tests for public.player_reviews
-- Run with a Postgres superuser (e.g., supabase_admin) or via `supabase db remote sql`.
--
-- Policies under test:
--   INSERT: WITH CHECK (reviewer_id = auth.uid())
--   SELECT: USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid())
--   UPDATE: USING (reviewer_id = auth.uid()) WITH CHECK (reviewer_id = auth.uid())
--   DELETE: USING (reviewer_id = auth.uid())

BEGIN;

-- Seed: two profiles + one finished game where user A and user B participated.
-- IDs are deterministic for the test.
DO $$
DECLARE
  uA uuid := '11111111-1111-1111-1111-11111111aaaa';
  uB uuid := '22222222-2222-2222-2222-22222222bbbb';
  uC uuid := '33333333-3333-3333-3333-33333333cccc'; -- outsider (NOT in the game)
  sport_id uuid;
  game_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (uA, 'a@test.local'), (uB, 'b@test.local'), (uC, 'c@test.local')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, display_name) VALUES
    (uA, 'A'), (uB, 'B'), (uC, 'C')
    ON CONFLICT (id) DO NOTHING;
  SELECT id INTO sport_id FROM public.sports LIMIT 1;
  INSERT INTO public.games (id, host_id, sport_id, title, starts_at, duration_min,
                            slots_total, price_cents, urgency, latitude, longitude,
                            status, visibility, duration_minutes)
  VALUES (game_id, uA, sport_id, 'rls test', now() - interval '2 hours', 60,
          2, 0, 'normal', -23.5, -46.6, 'open', 'public', 60);
  INSERT INTO public.game_participants (game_id, user_id, status) VALUES
    (game_id, uA, 'confirmed'), (game_id, uB, 'confirmed');
  -- A reviews B (legit)
  INSERT INTO public.player_reviews (game_id, reviewer_id, reviewee_id, rating, tags)
    VALUES (game_id, uA, uB, 5, ARRAY['Fair play']);
END $$;

-- TEST 1: outsider C (not reviewer, not reviewee) sees ZERO rows.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-33333333cccc","role":"authenticated"}';
SELECT 'T1 outsider read' AS test,
       count(*) AS rows_visible,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM public.player_reviews;

-- TEST 2: reviewee B sees exactly the review about them.
SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-22222222bbbb","role":"authenticated"}';
SELECT 'T2 reviewee read' AS test,
       count(*) AS rows_visible,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM public.player_reviews;

-- TEST 3: reviewer A sees their own review.
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-11111111aaaa","role":"authenticated"}';
SELECT 'T3 reviewer read' AS test,
       count(*) AS rows_visible,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM public.player_reviews;

-- TEST 4: outsider C cannot INSERT a review impersonating A (reviewer_id != auth.uid()).
SET LOCAL "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-33333333cccc","role":"authenticated"}';
DO $$
DECLARE g uuid;
BEGIN
  SELECT id INTO g FROM public.games WHERE title='rls test';
  BEGIN
    INSERT INTO public.player_reviews (game_id, reviewer_id, reviewee_id, rating, tags)
      VALUES (g, '11111111-1111-1111-1111-11111111aaaa',
                 '22222222-2222-2222-2222-22222222bbbb', 5, ARRAY['x']);
    RAISE NOTICE 'T4 impersonation insert: FAIL (insert was allowed)';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    RAISE NOTICE 'T4 impersonation insert: PASS (blocked: %)', SQLERRM;
  END;
END $$;

-- TEST 5: outsider C cannot INSERT a review as themselves (not a participant
-- of the game — validate_player_review trigger blocks it even if RLS passes).
DO $$
DECLARE g uuid;
BEGIN
  SELECT id INTO g FROM public.games WHERE title='rls test';
  BEGIN
    INSERT INTO public.player_reviews (game_id, reviewer_id, reviewee_id, rating, tags)
      VALUES (g, '33333333-3333-3333-3333-33333333cccc',
                 '22222222-2222-2222-2222-22222222bbbb', 5, ARRAY['x']);
    RAISE NOTICE 'T5 non-participant insert: FAIL (insert was allowed)';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'T5 non-participant insert: PASS (blocked: %)', SQLERRM;
  END;
END $$;

ROLLBACK;
