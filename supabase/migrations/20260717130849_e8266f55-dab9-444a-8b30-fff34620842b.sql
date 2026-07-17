-- Sugestões de amizade (#shitstorm 2) — calculadas, sem schema novo.
-- Sinais de confiança:
--   played_together = nº de jogos confirmados em comum ("já jogou com você")
--   mutual_friends  = nº de amigos em comum (amigo-de-amigo, 2º grau)
-- Exclui quem já é amigo ou tem pedido pendente. Ordena por confiança
-- (jogou junto pesa mais). Expõe só campos seguros (profiles_public).

CREATE OR REPLACE FUNCTION public.get_friend_suggestions(p_limit int DEFAULT 20)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  mutual_friends int,
  played_together int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  my_friends AS (
    SELECT CASE WHEN f.requester_id = (SELECT uid FROM me) THEN f.addressee_id ELSE f.requester_id END AS fid
    FROM public.friendships f, me
    WHERE f.status = 'accepted' AND (f.requester_id = me.uid OR f.addressee_id = me.uid)
  ),
  -- amigos dos meus amigos (2º grau), guardando por qual amigo (fid) chega
  fof AS (
    SELECT
      CASE WHEN f.requester_id = mf.fid THEN f.addressee_id ELSE f.requester_id END AS cand,
      mf.fid
    FROM public.friendships f
    JOIN my_friends mf ON (f.requester_id = mf.fid OR f.addressee_id = mf.fid)
    WHERE f.status = 'accepted'
  ),
  mutual AS (
    SELECT cand, COUNT(DISTINCT fid)::int AS mutual_friends
    FROM fof
    WHERE cand <> (SELECT uid FROM me)
    GROUP BY cand
  ),
  -- jogos em que EU fui confirmado
  my_games AS (
    SELECT gp.game_id
    FROM public.game_participants gp, me
    WHERE gp.user_id = me.uid AND gp.status = 'confirmed'
  ),
  played AS (
    SELECT gp.user_id AS cand, COUNT(DISTINCT gp.game_id)::int AS played_together
    FROM public.game_participants gp
    JOIN my_games mg ON mg.game_id = gp.game_id
    WHERE gp.status = 'confirmed' AND gp.user_id <> (SELECT uid FROM me)
    GROUP BY gp.user_id
  ),
  combined AS (
    SELECT
      COALESCE(m.cand, p.cand) AS uid,
      COALESCE(m.mutual_friends, 0) AS mutual_friends,
      COALESCE(p.played_together, 0) AS played_together
    FROM mutual m
    FULL OUTER JOIN played p ON m.cand = p.cand
  )
  SELECT c.uid, pp.display_name, pp.avatar_url, c.mutual_friends, c.played_together
  FROM combined c
  JOIN public.profiles_public pp ON pp.id = c.uid
  -- exclui quem já tem qualquer relação de amizade comigo (aceita ou pendente)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.friendships f, me
    WHERE (f.requester_id = me.uid AND f.addressee_id = c.uid)
       OR (f.addressee_id = me.uid AND f.requester_id = c.uid)
  )
  ORDER BY (c.played_together * 2 + c.mutual_friends) DESC, pp.display_name ASC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

REVOKE ALL ON FUNCTION public.get_friend_suggestions(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_suggestions(int) TO authenticated;
