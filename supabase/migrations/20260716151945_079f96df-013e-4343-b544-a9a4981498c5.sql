-- CORREÇÃO DE SEGURANÇA (crítica) — auto-aprovação de reivindicação de espaço.
--
-- A política de UPDATE de venue_claims permitia que o próprio solicitante
-- mudasse o status da sua reivindicação pendente para 'accepted', porque o
-- WITH CHECK só validava a autoria (claimant_id), sem restringir o status:
--
--   USING       (auth.uid() = claimant_id AND status = 'pending')
--   WITH CHECK  (auth.uid() = claimant_id)        -- <- não travava o status
--
-- Consequência: qualquer usuário autenticado podia reivindicar QUALQUER espaço
-- (quadra, clube, empresa) e se auto-aprovar como "dono", ganhando acesso ao
-- Painel do Espaço e agindo em nome do local. Não existe fluxo legítimo de
-- aprovação no app (nenhuma edge function/admin usa service_role), então a
-- aprovação para 'accepted' deve ser feita APENAS por service_role (dashboard
-- do Supabase hoje; futuramente uma função/admin dedicada), que ignora RLS.
--
-- Esta política passa a permitir que o solicitante apenas MANTENHA pendente ou
-- CANCELE (marque como 'rejected') a própria reivindicação — nunca 'accepted'.

DROP POLICY IF EXISTS "Claimants can cancel their pending claims" ON public.venue_claims;

CREATE POLICY "Claimants can cancel their pending claims"
  ON public.venue_claims
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = claimant_id AND status = 'pending')
  WITH CHECK (auth.uid() = claimant_id AND status IN ('pending', 'rejected'));

-- Defesa em profundidade: trava a coluna status via trigger, garantindo que
-- nenhuma transição para 'accepted' venha de chamada direta de usuário
-- (pg_trigger_depth() <= 1 = chamada direta; > 1 = dentro de outro trigger do
-- sistema). service_role continua livre para aprovar.
CREATE OR REPLACE FUNCTION public.venue_claims_guard_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted'
     AND OLD.status IS DISTINCT FROM 'accepted'
     AND current_setting('role', true) <> 'service_role'
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'venue claims can only be approved by an administrator';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venue_claims_guard_status ON public.venue_claims;
CREATE TRIGGER trg_venue_claims_guard_status
  BEFORE UPDATE ON public.venue_claims
  FOR EACH ROW EXECUTE FUNCTION public.venue_claims_guard_status();
