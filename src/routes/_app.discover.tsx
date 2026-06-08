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
  distance_meters: number | null;
  sports: { name: string; emoji: string; avg_rating: number | null; total_reviews: number | null } | null;
  venues: { name: string; address: string | null } | null;
  participants_count: number;
};

function Discover() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(10);

  useEffect(() => {
    if (!navigator.geolocation) return setGeoDenied(true);
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeoDenied(true),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5000 },
    );
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["games", coords?.lat, coords?.lng, radiusKm],
    enabled: coords !== null || geoDenied,
    queryFn: async (): Promise<GameRow[]> => {
      // Spatial path: PostGIS nearby_games RPC
      if (coords) {
        const wkt = `SRID=4326;POINT(${coords.lng} ${coords.lat})`;
        const { data: rows, error } = await supabase.rpc("nearby_games" as any, {
          user_location: wkt,
          radius_meters: radiusKm * 1000,
        });
        if (error) throw error;
        return await hydrate((rows ?? []) as any[]);
      }

      // Fallback: all upcoming games ordered by time
      const { data: rows, error } = await supabase
        .from("games")
        .select("id,title,starts_at,slots_total,price_cents,urgency,latitude,longitude,sport_id,venue_id")
        .gte("starts_at", new Date(Date.now() - 1000 * 60 * 60).toISOString())
        .order("starts_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return await hydrate((rows ?? []).map((r) => ({ ...r, distance_meters: null })));
    },
  });

  const games = useMemo(() => data ?? [], [data]);

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

      {coords && (
        <div className="mt-5 brutal-card-lg p-3 bg-paper">
          <div className="flex items-center justify-between text-xs font-bold uppercase">
            <span>Raio</span>
            <span className="bg-pop text-paper px-2 py-0.5">{radiusKm} km</span>
          </div>
          <div className="mt-2 flex gap-2">
            {[5, 10, 20, 50].map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r)}
                className={cn(
                  "flex-1 brutal-chip justify-center text-xs font-bold",
                  radiusKm === r ? "bg-pop text-paper border-ink" : "bg-paper",
                )}
              >
                {r}km
              </button>
            ))}
          </div>
        </div>
      )}

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

async function hydrate(rows: any[]): Promise<GameRow[]> {
  if (rows.length === 0) return [];
  const sportIds = [...new Set(rows.map((r) => r.sport_id).filter(Boolean))];
  const venueIds = [...new Set(rows.map((r) => r.venue_id).filter(Boolean))];
  const gameIds = rows.map((r) => r.id);

  const [sportsRes, venuesRes, partsRes] = await Promise.all([
    sportIds.length
      ? supabase.from("sports").select("id,name,emoji,avg_rating,total_reviews").in("id", sportIds)
      : Promise.resolve({ data: [] as any[] }),
    venueIds.length
      ? supabase.from("venues").select("id,name,address").in("id", venueIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("game_participants").select("game_id").in("game_id", gameIds),
  ]);

  const sportsMap = new Map((sportsRes.data ?? []).map((s: any) => [s.id, s]));
  const venuesMap = new Map((venuesRes.data ?? []).map((v: any) => [v.id, v]));
  const counts = new Map<string, number>();
  for (const p of (partsRes.data ?? []) as any[]) {
    counts.set(p.game_id, (counts.get(p.game_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    starts_at: r.starts_at,
    slots_total: r.slots_total,
    price_cents: r.price_cents,
    urgency: r.urgency,
    latitude: r.latitude,
    longitude: r.longitude,
    distance_meters: r.distance_meters ?? null,
    sports: sportsMap.get(r.sport_id) ?? null,
    venues: venuesMap.get(r.venue_id) ?? null,
    participants_count: counts.get(r.id) ?? 0,
  }));
}

function GameCard({ game, coords }: { game: GameRow; coords: { lat: number; lng: number } | null }) {
  const distKm =
    game.distance_meters != null
      ? game.distance_meters / 1000
      : coords
        ? distanceKm(coords.lat, coords.lng, game.latitude, game.longitude)
        : null;
  const filled = game.participants_count;
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
        {distKm != null && (
          <span className="brutal-chip bg-zap border-ink">
            <MapPin className="size-3" />
            {formatDistance(distKm)}
          </span>
        )}
        <span className="brutal-chip bg-paper">
          <MapPin className="size-3" />
          {game.venues?.name ?? "Sem local"}
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
