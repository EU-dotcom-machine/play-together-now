import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { distanceKm, formatDistance } from "@/lib/geo";
import { getCourtImage } from "@/lib/sport-courts";
import { useAuth } from "@/hooks/use-auth";
import { MapPin, Zap, Users, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { InstallPrompt } from "@/components/install-prompt";

export const Route = createFileRoute("/_app/discover")({
  head: () => ({ meta: [{ title: "Jogos perto de você — Esportes Unidos" }] }),
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
  sport_id: string | null;
  sports: { name: string; emoji: string; avg_rating: number | null; total_reviews: number | null } | null;
  venues: { name: string; address: string | null } | null;
  participants_count: number;
};

function Discover() {
  const { user } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [filterSportId, setFilterSportId] = useState<string | null>(null);

  const { data: sports } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id,name,emoji").order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!navigator.geolocation) return setGeoDenied(true);
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeoDenied(true),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5000 },
    );
  }, []);

  // Silently sync profile location when it changes by > ~200m
  useEffect(() => {
    if (!coords || !user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("latitude,longitude")
        .eq("id", user.id)
        .single();
      const lat = (prof as any)?.latitude as number | null;
      const lng = (prof as any)?.longitude as number | null;
      if (
        lat != null &&
        lng != null &&
        distanceKm(lat, lng, coords.lat, coords.lng) < 0.2
      )
        return;
      await supabase
        .from("profiles")
        .update({ latitude: coords.lat, longitude: coords.lng } as any)
        .eq("id", user.id);
    })();
  }, [coords, user]);

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

  const games = useMemo(
    () => (data ?? []).filter((g) => filterSportId === null || g.sport_id === filterSportId),
    [data, filterSportId],
  );
  const selectedSport = useMemo(
    () => sports?.find((s) => s.id === filterSportId),
    [sports, filterSportId],
  );

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
          className="brutal-card-lg px-3 py-2 bg-pop text-[#111] text-xs font-bold uppercase shrink-0"
        >
          + Criar
        </Link>
      </header>

      {coords && (
        <div className="mt-5 brutal-card-lg p-3 bg-paper">
          <div className="flex items-center justify-between text-xs font-bold uppercase">
            <span>Raio</span>
            <span className="bg-pop text-[#111] px-2 py-0.5">{radiusKm} km</span>
          </div>
          <div className="mt-2 flex gap-2">
            {[5, 10, 20, 50].map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r)}
                className={cn(
                  "flex-1 brutal-chip justify-center text-xs font-bold",
                  radiusKm === r ? "bg-pop text-[#111] border-ink" : "bg-paper",
                )}
              >
                {r}km
              </button>
            ))}
          </div>
        </div>
      )}

      {sports && sports.length > 0 && (
        <div className="mt-4 -mx-5 px-5">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setFilterSportId(null)}
              className={cn(
                "brutal-chip shrink-0 rounded-full px-3 py-1.5 text-xs font-bold",
                filterSportId === null ? "bg-pop text-[#111]" : "bg-paper text-ink/70",
              )}
            >
              Todos
            </button>
            {sports.map((s) => (
              <button
                key={s.id}
                onClick={() => setFilterSportId(filterSportId === s.id ? null : s.id)}
                className={cn(
                  "brutal-chip shrink-0 rounded-full px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5",
                  filterSportId === s.id ? "bg-pop text-[#111]" : "bg-paper text-ink/70",
                )}
              >
                <span>{s.emoji}</span>
                <span>{s.name}</span>
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
            <p className="font-bold uppercase">
              {selectedSport
                ? `Nenhum jogo de ${selectedSport.emoji} ${selectedSport.name} perto de você`
                : "Nenhum jogo rolando"}
            </p>
            <p className="text-sm text-ink/70 mt-1">
              {selectedSport ? (
                <button onClick={() => setFilterSportId(null)} className="underline underline-offset-2 text-pop">
                  Limpar filtro
                </button>
              ) : (
                "Que tal criar o primeiro?"
              )}
            </p>
          </div>
        )}
        {games.map((g) => (
          <GameCard key={g.id} game={g} coords={coords} />
        ))}
      </div>
      <InstallPrompt />
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
    supabase.from("game_participants").select("game_id").in("game_id", gameIds).eq("status" as any, "confirmed"),
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
    sport_id: r.sport_id ?? null,
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
  const imageUrl = getCourtImage(game.sports?.name);

  return (
    <Link
      to="/games/$id"
      params={{ id: game.id }}
      className="block rounded-2xl overflow-hidden relative transition-transform active:translate-y-[1px]"
      style={{
        backgroundColor: "#1E1E1E",
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.8)), url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "140px",
        borderLeft: "4px solid #FFD600",
        padding: "16px",
      }}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{game.sports?.emoji ?? "🏅"}</span>
          <div>
            <p className="uppercase text-white/70" style={{ fontSize: "10px", letterSpacing: "0.06em" }}>
              {game.sports?.name}
            </p>
            <h3 className="text-white font-bold leading-tight" style={{ fontSize: "15px" }}>
              {game.title}
            </h3>
          </div>
        </div>
        <UrgencyChip urgency={game.urgency} />
      </div>

      <div className="relative z-10 mt-3 flex flex-wrap gap-2 text-xs">
        {distKm != null && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-[#FFD600] text-[#111] font-bold">
            <MapPin className="size-3" />
            {formatDistance(distKm)}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-[#2A2A2A] text-white">
          <MapPin className="size-3" />
          {game.venues?.name ?? "Sem local"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-[#2A2A2A] text-white">
          {start.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}{" "}
          {start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-[#2A2A2A] text-white">
          <Users className="size-3" />
          {filled >= game.slots_total
            ? "Completo"
            : `Falta${game.slots_total - filled === 1 ? "" : "m"} ${game.slots_total - filled} jogador${game.slots_total - filled === 1 ? "" : "es"}`}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold",
            free ? "bg-[#FFD600] text-[#111]" : "bg-[#2A2A2A] text-white",
          )}
        >
          {free ? "DE GRAÇA" : `R$ ${(game.price_cents / 100).toFixed(2)}`}
        </span>
        {game.sports?.total_reviews && game.sports.total_reviews > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-[#2A2A2A] text-white">
            <Star className="size-3 fill-[#FFD600] stroke-[#FFD600]" />
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
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-[#FF4444] text-white text-xs" style={{ fontWeight: 800 }}>
        <Zap className="size-3" /> URGENTE
      </span>
    );
  if (urgency === "normal")
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 bg-[#FFD600] text-[#111] text-xs" style={{ fontWeight: 800 }}>
        NORMAL
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 bg-[#2A2A2A] text-white text-xs font-bold">
      RELAX
    </span>
  );
}
