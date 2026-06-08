import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { distanceKm, formatDistance } from "@/lib/geo";
import { MapPin, Zap, Users, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/discover")({
  head: () => ({ meta: [{ title: "Jogos perto de você — PEGA" }] }),
  component: Discover,
});

type GameRow = {
  id: string;
  title: string;
  starts_at: string;
  slots_total: number;
  price_cents: number;
  urgency: "relaxado" | "normal" | "urgente";
  latitude: number;
  longitude: number;
  sports: { name: string; emoji: string; avg_rating: number | null; total_reviews: number | null } | null;
  venues: { name: string; address: string | null } | null;
  game_participants: { count: number }[];
};

function Discover() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return setGeoDenied(true);
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeoDenied(true),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5000 },
    );
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["games"],
    queryFn: async (): Promise<GameRow[]> => {
      const { data, error } = await supabase
        .from("games")
        .select(
          "id,title,starts_at,slots_total,price_cents,urgency,latitude,longitude,sports(name,emoji,avg_rating,total_reviews),venues(name,address),game_participants(count)",
        )
        .gte("starts_at", new Date(Date.now() - 1000 * 60 * 60).toISOString())
        .order("starts_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as GameRow[];
    },
  });

  const [radiusKm, setRadiusKm] = useState<number>(10);

  const games = useMemo(() => {
    if (!data) return [];
    if (!coords) return data;
    return [...data]
      .map((g) => ({ g, d: distanceKm(coords.lat, coords.lng, g.latitude, g.longitude) }))
      .filter((x) => x.d <= radiusKm)
      .sort((a, b) => a.d - b.d)
      .map((x) => x.g);
  }, [data, coords, radiusKm]);

  return (
    <main className="px-5 pt-8 pb-4 max-w-md mx-auto">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold uppercase leading-none">Jogos<span className="text-pop">.</span></h1>
          <p className="mt-1 text-sm text-ink/70">
            {coords
              ? "Ordenados por distância de você"
              : geoDenied
                ? "Ative a localização pra ver o que tá rolando perto"
                : "Buscando sua localização…"}
          </p>
        </div>
        <Link
          to="/new"
          className="brutal-card-lg px-3 py-2 bg-pop text-paper text-xs font-bold uppercase shrink-0"
        >
          + Criar
        </Link>
      </header>

      <div className="mt-6 grid gap-3">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-ink/60">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
        {!isLoading && games.length === 0 && (
          <div className="brutal-card p-6 text-center">
            <p className="font-bold uppercase">Nenhum jogo rolando</p>
            <p className="text-sm text-ink/70 mt-1">Que tal criar o primeiro?</p>
          </div>
        )}
        {games.map((g) => (
          <GameCard key={g.id} game={g} coords={coords} />
        ))}
      </div>
    </main>
  );
}

function GameCard({ game, coords }: { game: GameRow; coords: { lat: number; lng: number } | null }) {
  const dist = coords ? distanceKm(coords.lat, coords.lng, game.latitude, game.longitude) : null;
  const filled = game.game_participants?.[0]?.count ?? 0;
  const start = new Date(game.starts_at);
  const free = game.price_cents === 0;

  return (
    <Link
      to="/games/$id"
      params={{ id: game.id }}
      className="brutal-card-lg p-4 bg-paper block transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{game.sports?.emoji ?? "🏅"}</span>
          <div>
            <p className="text-xs font-bold uppercase text-ink/60">{game.sports?.name}</p>
            <h3 className="text-lg font-bold leading-tight">{game.title}</h3>
          </div>
        </div>
        <UrgencyChip urgency={game.urgency} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="brutal-chip bg-paper">
          <MapPin className="size-3" />
          {game.venues?.name ?? "Sem local"}
          {dist != null && ` • ${formatDistance(dist)}`}
        </span>
        <span className="brutal-chip bg-paper">
          {start.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}{" "}
          {start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="brutal-chip bg-paper">
          <Users className="size-3" />
          {filled}/{game.slots_total}
        </span>
        <span className={cn("brutal-chip", free ? "bg-zap" : "bg-paper")}>
          {free ? "DE GRAÇA" : `R$ ${(game.price_cents / 100).toFixed(2)}`}
        </span>
        {game.sports?.total_reviews && game.sports.total_reviews > 0 ? (
          <span className="brutal-chip bg-paper">
            <Star className="size-3 fill-pop stroke-ink" />
            {game.sports.avg_rating?.toFixed(1)} · {game.sports.total_reviews}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function UrgencyChip({ urgency }: { urgency: GameRow["urgency"] }) {
  if (urgency === "urgente")
    return (
      <span className="brutal-chip bg-pop text-paper border-ink">
        <Zap className="size-3" /> URGENTE
      </span>
    );
  if (urgency === "normal") return <span className="brutal-chip bg-zap">NORMAL</span>;
  return <span className="brutal-chip bg-paper">RELAX</span>;
}
