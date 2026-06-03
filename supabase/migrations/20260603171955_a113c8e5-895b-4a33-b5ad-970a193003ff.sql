
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  favorite_sport_id UUID,
  sponsor_brand TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  city TEXT,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- SPORTS
CREATE TABLE public.sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL DEFAULT '🏅',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sports TO authenticated, anon;
GRANT ALL ON public.sports TO service_role;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sports public read" ON public.sports FOR SELECT USING (true);

INSERT INTO public.sports (name, slug, emoji) VALUES
('Futebol','futebol','⚽'),
('Futsal','futsal','🥅'),
('Vôlei','volei','🏐'),
('Beach Tennis','beach-tennis','🎾'),
('Tênis','tenis','🎾'),
('Basquete','basquete','🏀'),
('Handebol','handebol','🤾'),
('Corrida','corrida','🏃'),
('Ciclismo','ciclismo','🚴'),
('Skate','skate','🛹'),
('Surf','surf','🏄'),
('Natação','natacao','🏊'),
('Crossfit','crossfit','🏋️'),
('Padel','padel','🎾'),
('Pickleball','pickleball','🥒'),
('MMA','mma','🥊');

-- VENUES
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venues read all" ON public.venues FOR SELECT TO authenticated USING (true);
CREATE POLICY "venues insert own" ON public.venues FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "venues update own" ON public.venues FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "venues delete own" ON public.venues FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- GAMES
CREATE TYPE public.game_urgency AS ENUM ('relaxado','normal','urgente');
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id),
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  slots_total INT NOT NULL DEFAULT 10,
  price_cents INT NOT NULL DEFAULT 0,
  urgency public.game_urgency NOT NULL DEFAULT 'normal',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games read all" ON public.games FOR SELECT TO authenticated USING (true);
CREATE POLICY "games insert own" ON public.games FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "games update own" ON public.games FOR UPDATE TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "games delete own" ON public.games FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- PARTICIPANTS
CREATE TABLE public.game_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_participants TO authenticated;
GRANT ALL ON public.game_participants TO service_role;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read all" ON public.game_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "participants insert self" ON public.game_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "participants delete self" ON public.game_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Award points for urgent games when joining
CREATE OR REPLACE FUNCTION public.award_urgency_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u public.game_urgency;
BEGIN
  SELECT urgency INTO u FROM public.games WHERE id = NEW.game_id;
  IF u = 'urgente' THEN
    UPDATE public.profiles SET points = points + 10 WHERE id = NEW.user_id;
  ELSIF u = 'normal' THEN
    UPDATE public.profiles SET points = points + 3 WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles SET points = points + 1 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_award_points AFTER INSERT ON public.game_participants
FOR EACH ROW EXECUTE FUNCTION public.award_urgency_points();

-- MESSAGES (chat por jogo)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_game_participant(_game_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_participants WHERE game_id = _game_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.games WHERE id = _game_id AND host_id = _user_id
  );
$$;

CREATE POLICY "messages read participants" ON public.messages FOR SELECT TO authenticated
  USING (public.is_game_participant(game_id, auth.uid()));
CREATE POLICY "messages insert participants" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_game_participant(game_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_participants;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
