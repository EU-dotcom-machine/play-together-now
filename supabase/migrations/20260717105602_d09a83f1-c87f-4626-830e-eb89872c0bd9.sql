-- Cadastro de Espaços — Fase 1: campos de verificação + guard de segurança.
-- Um espaço é cadastrado com CNPJ e entra como 'pending'. A aprovação
-- (is_verified=true, registration_status='approved', owner_id) é feita APENAS
-- por service_role (dashboard do Supabase por ora) — nunca pelo próprio usuário.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- CHECK do status (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_registration_status_chk'
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_registration_status_chk
      CHECK (registration_status IN ('none', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS venues_registration_status_idx
  ON public.venues (registration_status);

-- Guard: usuário comum nunca se auto-verifica/aprova/atribui dono.
-- Força valores seguros no INSERT e preserva os campos privilegiados no UPDATE.
-- service_role (aprovação via dashboard/admin) ignora e pode setar tudo.
CREATE OR REPLACE FUNCTION public.venues_guard_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_verified := false;
      NEW.owner_id := NULL;
      IF NEW.registration_status NOT IN ('none', 'pending') THEN
        NEW.registration_status := 'pending';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.is_verified := OLD.is_verified;
      NEW.registration_status := OLD.registration_status;
      NEW.owner_id := OLD.owner_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venues_guard_verification ON public.venues;
CREATE TRIGGER trg_venues_guard_verification
  BEFORE INSERT OR UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.venues_guard_verification();
