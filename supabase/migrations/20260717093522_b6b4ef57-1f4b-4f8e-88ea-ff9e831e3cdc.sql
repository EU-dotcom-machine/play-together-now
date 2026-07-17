-- RANKING (atletas + espaços) — calculado sob demanda, SEM contador/trigger.
-- Fonte da verdade: game_participants confirmados + games.
-- Regras: valor por vaga confirmada urgente=5/normal=3/relaxado=1.
--   Atleta = soma das próprias participações confirmadas (por esporte).
--   Host   = +1 por participante confirmado nos jogos que organiza.
--   Espaço = soma de participantes confirmados nos jogos realizados nele.
-- Temporada = mês de games.starts_at (date_trunc). Todos os tempos = sem filtro.

-- ============ VIEWS de agregação (security_invoker=false => ignora RLS,
--              igual à profiles_public; expostas só via funções abaixo) ============

CREATE OR REPLACE VIEW public.v_athlete_points WITH (security_invoker = false) AS
WITH participante AS (
  SELECT gp.user_id,
         g.sport_id,
         date_trunc('month', g.starts_at)::date AS season,
         SUM(CASE g.urgency WHEN 'urgente' THEN 5 WHEN 'normal' THEN 3 ELSE 1 END)::int AS pts
  FROM public.game_participants gp
  JOIN public.games g ON g.id = gp.game_id
  WHERE gp.status = 'confirmed'
  GROUP BY 1, 2, 3
),
anfitriao AS (
  SELECT g.host_id AS user_id,
         g.sport_id,
         date_trunc('month', g.starts_at)::date AS season,
         COUNT(*)::int AS pts               -- +1 por participante confirmado
  FROM public.games g
  JOIN public.game_participants gp ON gp.game_id = g.id AND gp.status = 'confirmed'
  GROUP BY 1, 2, 3
)
SELECT user_id, sport_id, season, SUM(pts)::int AS points
FROM (SELECT * FROM participante UNION ALL SELECT * FROM anfitriao) t
WHERE user_id IS NOT NULL
GROUP BY user_id, sport_id, season;

CREATE OR REPLACE VIEW public.v_venue_points WITH (security_invoker = false) AS
SELECT g.venue_id,
       g.sport_id,
       date_trunc('month', g.starts_at)::date AS season,
       COUNT(*)::int AS points               -- participantes confirmados no espaço
FROM public.games g
JOIN public.game_participants gp ON gp.game_id = g.id AND gp.status = 'confirmed'
WHERE g.venue_id IS NOT NULL
GROUP BY 1, 2, 3;

-- ============ Funções RPC (SECURITY DEFINER; expõem só campos seguros) ============

-- Atletas. p_sport NULL = global; p_season NULL = todos os tempos;
-- p_scope 'all' | 'friends'.
CREATE OR REPLACE FUNCTION public.get_athlete_ranking(
  p_sport  uuid  DEFAULT NULL,
  p_season date  DEFAULT NULL,
  p_scope  text  DEFAULT 'all',
  p_limit  int   DEFAULT 50
)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, points int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.user_id,
         pp.display_name,
         pp.avatar_url,
         SUM(r.points)::int AS points
  FROM public.v_athlete_points r
  JOIN public.profiles_public pp ON pp.id = r.user_id
  WHERE (p_sport  IS NULL OR r.sport_id = p_sport)
    AND (p_season IS NULL OR r.season   = p_season)
    AND (
      p_scope <> 'friends'
      OR r.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ( (f.requester_id = auth.uid() AND f.addressee_id = r.user_id)
             OR (f.addressee_id = auth.uid() AND f.requester_id = r.user_id) )
      )
    )
  GROUP BY r.user_id, pp.display_name, pp.avatar_url
  HAVING SUM(r.points) > 0
  ORDER BY points DESC, pp.display_name ASC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

-- Espaços. p_sport NULL = global; p_season NULL = todos os tempos. Só públicos.
CREATE OR REPLACE FUNCTION public.get_venue_ranking(
  p_sport  uuid  DEFAULT NULL,
  p_season date  DEFAULT NULL,
  p_limit  int   DEFAULT 50
)
RETURNS TABLE(venue_id uuid, name text, address text, points int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.venue_id,
         v.name,
         v.address,
         SUM(r.points)::int AS points
  FROM public.v_venue_points r
  JOIN public.venues v ON v.id = r.venue_id
  WHERE v.is_public = true
    AND (p_sport  IS NULL OR r.sport_id = p_sport)
    AND (p_season IS NULL OR r.season   = p_season)
  GROUP BY r.venue_id, v.name, v.address
  HAVING SUM(r.points) > 0
  ORDER BY points DESC, v.name ASC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

-- Permissões: só usuários autenticados executam.
REVOKE ALL ON FUNCTION public.get_athlete_ranking(uuid, date, text, int) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_venue_ranking(uuid, date, int)         FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_ranking(uuid, date, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_ranking(uuid, date, int)         TO authenticated;
