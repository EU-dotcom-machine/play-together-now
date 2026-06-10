
-- Add status to game_participants for approval flow
ALTER TABLE public.game_participants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending','confirmed','declined'));

CREATE INDEX IF NOT EXISTS game_participants_status_idx
  ON public.game_participants(game_id, status);

-- Allow the game host to update participant rows (approve/decline)
DROP POLICY IF EXISTS "host updates participants" ON public.game_participants;
CREATE POLICY "host updates participants"
  ON public.game_participants
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.host_id = auth.uid()));

-- Award points only when a participant becomes confirmed
CREATE OR REPLACE FUNCTION public.award_urgency_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE u public.game_urgency;
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN
    RETURN NEW;
  END IF;
  SELECT urgency INTO u FROM public.games WHERE id = NEW.game_id;
  IF u = 'urgente' THEN
    UPDATE public.profiles SET points = points + 5 WHERE id = NEW.user_id;
  ELSIF u = 'normal' THEN
    UPDATE public.profiles SET points = points + 3 WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles SET points = points + 1 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

-- Re-bind trigger to fire on INSERT and on status UPDATE
DROP TRIGGER IF EXISTS trg_award_points ON public.game_participants;
CREATE TRIGGER trg_award_points
  AFTER INSERT OR UPDATE OF status ON public.game_participants
  FOR EACH ROW EXECUTE FUNCTION public.award_urgency_points();

-- nearby_games unchanged in signature; participants_count in UI now filters by status.
