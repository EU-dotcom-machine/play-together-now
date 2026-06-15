CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('game_confirmed','game_declined','friend_request','game_nearby')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id) WHERE read = false;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Trigger: game_participants status change -> confirmed/declined
CREATE OR REPLACE FUNCTION public.notify_participant_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (NEW.user_id, 'game_confirmed',
      'Você foi confirmado! 🙋',
      'Sua vaga foi garantida. Acesse o jogo para ver o chat.',
      jsonb_build_object('game_id', NEW.game_id));
  ELSIF NEW.status = 'declined' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'declined') THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (NEW.user_id, 'game_declined',
      'Não foi dessa vez.',
      'Sua solicitação foi recusada. Tente outro jogo!',
      jsonb_build_object('game_id', NEW.game_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_participant_status_trg ON public.game_participants;
CREATE TRIGGER notify_participant_status_trg
AFTER INSERT OR UPDATE OF status ON public.game_participants
FOR EACH ROW EXECUTE FUNCTION public.notify_participant_status();

-- Trigger: friendships insert -> friend_request
CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_name text;
BEGIN
  SELECT display_name INTO requester_name FROM public.profiles WHERE id = NEW.requester_id;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (NEW.addressee_id, 'friend_request',
    'Pedido de amizade',
    COALESCE(requester_name, 'Alguém') || ' quer jogar com você.',
    jsonb_build_object('requester_id', NEW.requester_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_friend_request_trg ON public.friendships;
CREATE TRIGGER notify_friend_request_trg
AFTER INSERT ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();
