
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['game_confirmed','game_declined','friend_request','game_nearby','venue_claim_accepted','venue_claim_rejected']));

CREATE OR REPLACE FUNCTION public.notify_venue_claim_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted','rejected') THEN
    SELECT name INTO v_name FROM public.venues WHERE id = NEW.venue_id;
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (NEW.claimant_id, 'venue_claim_accepted',
        'Reivindicação aceita ✓',
        'Sua solicitação para ' || COALESCE(v_name,'o espaço') || ' foi aceita.',
        jsonb_build_object('venue_id', NEW.venue_id, 'claim_id', NEW.id));
    ELSE
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (NEW.claimant_id, 'venue_claim_rejected',
        'Reivindicação recusada',
        'Sua solicitação para ' || COALESCE(v_name,'o espaço') || ' foi recusada.',
        jsonb_build_object('venue_id', NEW.venue_id, 'claim_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_venue_claim_status ON public.venue_claims;
CREATE TRIGGER trg_notify_venue_claim_status
AFTER UPDATE ON public.venue_claims
FOR EACH ROW
EXECUTE FUNCTION public.notify_venue_claim_status();
