-- Reparo do sistema de pontos (achado A3 da auditoria de 15-16/07/2026).
--
-- Diagnóstico (SQL editor de produção, 16/07/2026): existe um trigger
-- "profiles_prevent_points_self_update" em public.profiles que NÃO consta em
-- nenhuma migration do repositório (foi criado direto no banco). Ele bloqueia/
-- descarta silenciosamente qualquer alteração de points — inclusive a premiação
-- legítima feita pelo trigger award_urgency_points ao confirmar participantes.
-- Resultado observado: nenhum participante confirmado pontua (todos os perfis
-- com 0 pontos, apesar de confirmações em 30/06, 07/07 e 14/07).
--
-- A proteção correta já existe e permanece ativa: enforce_points_protection
-- (protect_points v3, migration 20260616153205), que usa pg_trigger_depth()
-- para liberar apenas o fluxo do sistema.

-- 1) Remove o trigger duplicado criado fora das migrations
DROP TRIGGER IF EXISTS profiles_prevent_points_self_update ON public.profiles;

-- 2) Backfill: recalcula os pontos de TODOS os perfis a partir das participações
--    confirmadas, usando a mesma regra do award_urgency_points
--    (urgente = 5, normal = 3, demais = 1).
--    A proteção é desativada temporariamente para permitir a escrita administrativa.
ALTER TABLE public.profiles DISABLE TRIGGER enforce_points_protection;

UPDATE public.profiles p
SET points = COALESCE((
  SELECT SUM(
    CASE g.urgency
      WHEN 'urgente' THEN 5
      WHEN 'normal' THEN 3
      ELSE 1
    END
  )::int
  FROM public.game_participants gp
  JOIN public.games g ON g.id = gp.game_id
  WHERE gp.user_id = p.id
    AND gp.status = 'confirmed'
), 0);

ALTER TABLE public.profiles ENABLE TRIGGER enforce_points_protection;
