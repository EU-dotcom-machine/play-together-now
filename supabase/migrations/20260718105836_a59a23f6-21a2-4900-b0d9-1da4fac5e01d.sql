-- Painel do dono do espaço (Fase 2): o dono aprovado (owner_id) pode VER e
-- EDITAR o próprio espaço, mesmo que is_public=false. Os campos privilegiados
-- (is_verified, registration_status, owner_id) continuam travados pelo trigger
-- venues_guard_verification (só service_role altera).

-- SELECT: dono ou criador enxergam o próprio espaço (a política pública
-- "is_public = true" continua valendo para os demais).
DROP POLICY IF EXISTS "venue owner or creator select" ON public.venues;
CREATE POLICY "venue owner or creator select"
  ON public.venues FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR created_by = auth.uid());

-- UPDATE: dono aprovado pode editar (nome, descrição, contato, is_public…).
-- (A política "venues update own" por created_by já existe; esta cobre o caso
--  em que owner_id != created_by, ex.: espaço criado por outro e reivindicado.)
DROP POLICY IF EXISTS "venue owner update" ON public.venues;
CREATE POLICY "venue owner update"
  ON public.venues FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
