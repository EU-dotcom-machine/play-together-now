import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { distanceKm, formatDistance } from "@/lib/geo";
import { getCourtImage } from "@/lib/sport-courts";
import { useAuth } from "@/hooks/use-auth";
import { MapPin, Zap, Users, Loader2, Star, Lock, Plus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { InstallPrompt } from "@/components/install-prompt";
import { NotificationsBell } from "@/components/notifications-bell";
import { VenueClaimDialog } from "@/components/venue-claim-dialog";

export const Route = createFileRoute("/_app/discover")({
  head: () => ({ meta: [{ title: "Jogos perto de você — Esportes Unidos" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "estabelecimentos" ? ("estabelecimentos" as const) : undefined,
    venueId: typeof search.venueId === "string" ? search.venueId : undefined,
  }),
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
  visibility: "public" | "friends" | "cep";
  cep: string | null;
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
  const [tab, setTab] = useState<"jogos" | "estabelecimentos">("jogos");
  const [filterVenueId, setFilterVenueId] = useState<string | null>(null);
  const [claimVenue, setClaimVenue] = useState<{ id: string; name: string } | null>(null);


  const { data: sports } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id,name,emoji").order("name");
      return data ?? [];
    },
  });

  const { data: viewerProfile } = useQuery({
    queryKey: ["viewer-profile-cep", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("cep").eq("id", user!.id).single();
      return (data as any) ?? null;
    },
  });
  const viewerCep = ((viewerProfile as any)?.cep ?? "").toString().trim();
  const hasCep = viewerCep.length > 0;

  useEffect(() => {
    if (!navigator.geolocation) return setGeoDenied(true);
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeoDenied(true),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
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
    queryKey: ["games", coords?.lat, coords?.lng, radiusKm, user?.id],
    enabled: coords !== null || geoDenied,
    queryFn: async (): Promise<GameRow[]> => {
      const nowMs = Date.now();
      const notEnded = (r: any) => {
        if (r.ends_at) return new Date(r.ends_at).getTime() > nowMs;
        return new Date(r.starts_at).getTime() > nowMs;
      };

      // Spatial path: PostGIS nearby_games RPC (server-side visibility filter)
      if (coords) {
        const wkt = `SRID=4326;POINT(${coords.lng} ${coords.lat})`;
        const { data: rows, error } = await supabase.rpc("nearby_games" as any, {
          user_location: wkt,
          radius_meters: radiusKm * 1000,
        });
        if (error) throw error;
        return await hydrate(((rows ?? []) as any[]).filter(notEnded));
      }

      // Fallback: load viewer context for visibility filtering
      let friendHostIds: string[] = [];
      let participantGameIds: string[] = [];
      let viewerCep: string | null = null;
      if (user) {
        const [friendsRes, profRes, partsRes] = await Promise.all([
          supabase
            .from("friendships")
            .select("requester_id,addressee_id")
            .eq("status" as any, "accepted")
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
          supabase.from("profiles").select("cep").eq("id", user.id).single(),
          supabase
            .from("game_participants")
            .select("game_id")
            .eq("user_id", user.id)
            .eq("status" as any, "confirmed"),
        ]);
        friendHostIds = ((friendsRes.data ?? []) as any[]).map((f) =>
          f.requester_id === user.id ? f.addressee_id : f.requester_id,
        );
        viewerCep = ((profRes.data as any)?.cep ?? null) as string | null;
        participantGameIds = ((partsRes.data ?? []) as any[]).map((p) => p.game_id);
      }

      // WHERE: public OR host=me OR I'm a confirmed participant OR friends+host-is-friend OR matching cep
      const orParts = ["visibility.eq.public"];
      if (user) orParts.push(`host_id.eq.${user.id}`);
      if (participantGameIds.length > 0)
        orParts.push(`id.in.(${participantGameIds.join(",")})`);
      if (friendHostIds.length > 0)
        orParts.push(`and(visibility.eq.friends,host_id.in.(${friendHostIds.join(",")}))`);
      if (viewerCep) orParts.push(`and(visibility.eq.cep,cep.eq.${viewerCep})`);

      const { data: rows, error } = await supabase
        .from("games")
        .select("id,title,starts_at,ends_at,slots_total,price_cents,urgency,latitude,longitude,sport_id,venue_id,host_id,visibility,cep")
        .in("status", ["open", "full"])
        .gte("starts_at", new Date().toISOString())
        .or(orParts.join(","))
        .order("starts_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return await hydrate(((rows ?? []) as any[]).filter(notEnded).map((r) => ({ ...r, distance_meters: null })));
    },

  });

  const games = useMemo(
    () =>
      (data ?? [])
        .filter((g) => filterSportId === null || g.sport_id === filterSportId)
        .filter((g) => filterVenueId === null || (g as any).venues?.id === filterVenueId || (g as any).venue_id === filterVenueId)
        .filter((g) => {
          // Hide 'cep' (condomínio) games when the viewer hasn't filled their CEP,
          // unless they are the host of that game.
          if (g.visibility !== "cep") return true;
          if (hasCep) return true;
          return false;
        }),
    [data, filterSportId, filterVenueId, hasCep],
  );
  const selectedSport = useMemo(
    () => sports?.find((s) => s.id === filterSportId),
    [sports, filterSportId],
  );

  // Build venues from the same visible games (so visibility/RLS already applied)
  const venuesAgg = useMemo(() => {
    const map = new Map<string, { id: string; name: string; address: string | null; sports: Set<string>; count: number; latitude?: number | null; longitude?: number | null }>();
    for (const g of (data ?? [])) {
      const vid = (g as any).venue_id ?? (g as any).venues?.id;
      const venue = (g as any).venues;
      if (!vid || !venue) continue;
      const entry = map.get(vid) ?? {
        id: vid,
        name: venue.name,
        address: venue.address ?? null,
        sports: new Set<string>(),
        count: 0,
        latitude: venue.latitude ?? null,
        longitude: venue.longitude ?? null,
      };
      entry.count += 1;
      if (g.sports?.name) entry.sports.add(`${g.sports.emoji ?? ""} ${g.sports.name}`);
      map.set(vid, entry);
    }
    return Array.from(map.values());
  }, [data]);

  const { data: publicVenues = [] } = useQuery({
    queryKey: ["public-venues", venuesAgg.map((v) => v.id).join(",")],
    enabled: venuesAgg.length > 0,
    queryFn: async () => {
      const ids = venuesAgg.map((v) => v.id);
      const { data: rows } = await supabase
        .from("venues")
        .select("id,name,address,description,phone,instagram,latitude,longitude,is_public,venue_type" as any)
        .in("id", ids)
        .eq("is_public" as any, true)
        .eq("venue_type" as any, "establishment");
      return (rows ?? []) as any[];
    },
  });

  const establishments = useMemo(() => {
    const publicMap = new Map(publicVenues.map((v: any) => [v.id, v]));
    return venuesAgg
      .filter((v) => publicMap.has(v.id))
      .map((v) => {
        const pub = publicMap.get(v.id)!;
        const distKm = coords && pub.latitude != null && pub.longitude != null
          ? distanceKm(coords.lat, coords.lng, pub.latitude, pub.longitude)
          : null;
        return {
          id: v.id,
          name: pub.name ?? v.name,
          address: pub.address ?? v.address,
          description: pub.description ?? null,
          phone: pub.phone ?? null,
          instagram: pub.instagram ?? null,
          sports: Array.from(v.sports),
          count: v.count,
          distKm,
        };
      })
      .sort((a, b) => (a.distKm ?? Infinity) - (b.distKm ?? Infinity));
  }, [venuesAgg, publicVenues, coords]);

  const venueIdsKey = establishments.map((e) => e.id).join(",");
  const { data: myClaims = [] } = useQuery({
    queryKey: ["my-venue-claims", user?.id, venueIdsKey],
    enabled: !!user && establishments.length > 0,
    queryFn: async () => {
      const ids = establishments.map((e) => e.id);
      const { data } = await supabase
        .from("venue_claims" as any)
        .select("venue_id,status")
        .eq("claimant_id", user!.id)
        .in("venue_id", ids);
      return ((data ?? []) as unknown) as { venue_id: string; status: "pending" | "accepted" | "rejected" }[];
    },
  });
  const claimByVenue = useMemo(() => {
    const m = new Map<string, "pending" | "accepted" | "rejected">();
    for (const c of myClaims) {
      const prev = m.get(c.venue_id);
      // prefer accepted > pending > rejected
      const rank = (s: string) => (s === "accepted" ? 3 : s === "pending" ? 2 : 1);
      if (!prev || rank(c.status) > rank(prev)) m.set(c.venue_id, c.status);
    }
    return m;
  }, [myClaims]);



  return (
    <main className="px-5 pt-8 pb-4 max-w-md mx-auto">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold uppercase leading-none">Jogos<span className="text-pop">.</span></h1>
          <p className="mt-1 text-sm text-ink/70">
            {coords
              ? "Jogos acontecendo perto de você"
              : geoDenied
                ? "Ative a localização para ver jogos perto de você"
                : "Buscando sua localização…"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationsBell />
          <Link
            to="/new"
            aria-label="Criar jogo"
            className="inline-flex items-center justify-center size-10 rounded-full bg-pop text-[#111] active:translate-y-[1px]"
          >
            <Plus className="size-5" strokeWidth={3} />
          </Link>
        </div>
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

      {user && !hasCep && (
        <div className="mt-4 brutal-card-lg p-3 bg-paper flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-pop" />
          <div className="text-xs leading-snug">
            <p className="font-bold uppercase">Preencha seu CEP</p>
            <p className="text-ink/70 mt-0.5">
              Jogos de condomínio só aparecem para quem tem o mesmo CEP.{" "}
              <Link to="/profile" className="underline underline-offset-2 font-bold text-pop">
                Atualizar perfil
              </Link>
            </p>
          </div>
        </div>
      )}



      <div className="mt-5 flex gap-2">
        <button
          onClick={() => setTab("jogos")}
          className={cn(
            "flex-1 brutal-chip justify-center text-xs font-bold uppercase py-2",
            tab === "jogos" ? "bg-pop text-[#111] border-ink" : "bg-paper",
          )}
        >
          Jogos
        </button>
        <button
          onClick={() => setTab("estabelecimentos")}
          className={cn(
            "flex-1 brutal-chip justify-center text-xs font-bold uppercase py-2",
            tab === "estabelecimentos" ? "bg-pop text-[#111] border-ink" : "bg-paper",
          )}
        >
          Estabelecimentos
        </button>
      </div>

      {tab === "jogos" && sports && sports.length > 0 && (
        <div className="mt-4 -mx-5 px-5">
          <div className="relative">
            <div
              className="flex gap-2 overflow-x-auto pb-1 chips-filter"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
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
            <div
              className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none"
              style={{ background: "linear-gradient(to right, transparent, #111111)" }}
            />
          </div>
        </div>
      )}

      {tab === "jogos" && filterVenueId && (
        <div className="mt-3 flex items-center justify-between brutal-card p-2 bg-paper text-xs">
          <span className="font-bold uppercase truncate">
            Filtrando por: {establishments.find((e) => e.id === filterVenueId)?.name ?? "Local"}
          </span>
          <button onClick={() => setFilterVenueId(null)} className="font-bold text-pop underline">
            Limpar
          </button>
        </div>
      )}

      {tab === "jogos" && (
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
      )}

      {tab === "estabelecimentos" && (
        <div className="mt-6 grid gap-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-ink/60">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
          {!isLoading && establishments.length === 0 && (
            <div className="brutal-card p-6 text-center">
              <p className="font-bold uppercase">Nenhum estabelecimento por perto</p>
              <p className="text-sm text-ink/70 mt-1">
                Não há jogos abertos em locais públicos no raio selecionado.
              </p>
            </div>
          )}
          {establishments.map((v) => (
            <div key={v.id} className="brutal-card p-4 bg-paper">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-extrabold text-lg uppercase truncate leading-tight">{v.name}</h3>
                  {v.address && (
                    <p className="text-xs text-ink/60 mt-1 flex items-center gap-1 truncate">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{v.address}</span>
                    </p>
                  )}
                </div>
                {v.distKm != null && (
                  <span className="shrink-0 text-[11px] font-bold bg-pop text-[#111] px-2 py-0.5 rounded-full">
                    {formatDistance(v.distKm)}
                  </span>
                )}
              </div>
              {v.sports.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {v.sports.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-ink/20 bg-paper text-ink/80"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-ink/80">
                  {v.count} {v.count === 1 ? "jogo disponível" : "jogos disponíveis"}
                </p>
                <button
                  onClick={() => {
                    setFilterVenueId(v.id);
                    setFilterSportId(null);
                    setTab("jogos");
                  }}
                  className="brutal-chip bg-pop text-[#111] text-xs font-bold px-3 py-1.5"
                >
                  Ver jogos
                </button>
              </div>
              {(() => {
                const cs = claimByVenue.get(v.id);
                const label =
                  cs === "accepted"
                    ? "✓ Espaço reivindicado por você"
                    : cs === "pending"
                      ? "⏳ Solicitação pendente"
                      : cs === "rejected"
                        ? "Reivindicar este espaço (reenviar)"
                        : "Reivindicar este espaço";
                return (
                  <button
                    onClick={() => setClaimVenue({ id: v.id, name: v.name })}
                    disabled={cs === "accepted"}
                    className="mt-2 w-full text-xs font-bold uppercase border border-ink/20 rounded-md py-1.5 hover:bg-ink/5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {label}
                  </button>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {claimVenue && (
        <VenueClaimDialog
          open={!!claimVenue}
          onOpenChange={(o) => !o && setClaimVenue(null)}
          venueId={claimVenue.id}
          venueName={claimVenue.name}
        />
      )}

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
      ? supabase.from("venues").select("id,name,address,latitude,longitude")
          .in("id", venueIds)
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
    visibility: (r.visibility as GameRow["visibility"]) ?? "public",
    cep: r.cep ?? null,
    sports: sportsMap.get(r.sport_id) ?? null,
    venues: venuesMap.get(r.venue_id) ?? null,
    venue_id: r.venue_id ?? null,
    participants_count: counts.get(r.id) ?? 0,
  })) as any;
}


const sportColor: Record<string, string> = {
  "Futebol":        "#00b140",
  "Futsal":         "#00b140",
  "Society":        "#00b140",
  "Basquete":       "#ff6b00",
  "Vôlei":          "#0066cc",
  "Vôlei de Praia": "#f5a623",
  "Beach Tennis":   "#f5a623",
  "Tênis":          "#7bc043",
  "Padel":          "#00c9a7",
  "Natação":        "#00aaff",
  "Corrida":        "#ff4444",
  "Ciclismo":       "#ff8c00",
  "Skate":          "#9b59b6",
  "Surf":           "#00bcd4",
  "Handebol":       "#e91e63",
  "Pickleball":     "#cddc39",
  "MMA / Luta":     "#c0392b",
  "Golfe":          "#2ecc71",
  "Tênis de Mesa":  "#3498db",
  "Badminton":      "#e67e22",
  "CrossFit":       "#e74c3c",
  "Yoga":           "#9c27b0",
};

function GameCard({ game, coords }: { game: GameRow; coords: { lat: number; lng: number } | null }) {
  const borderColor = sportColor[game.sports?.name ?? ""] ?? "#FFD600";
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
        borderLeft: `4px solid ${borderColor}`,
        padding: "16px",
      }}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{game.sports?.emoji ?? "🏅"}</span>
          <div>
            <p className="uppercase" style={{ color: borderColor, fontSize: "10px", letterSpacing: "0.06em" }}>
              {game.sports?.name}
            </p>
            <h3 className="text-white font-bold leading-tight inline-flex items-center gap-1.5" style={{ fontSize: "15px" }}>
              {game.visibility !== "public" && <Lock className="size-3.5 text-white/80" />}
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
            {formatDistance(distKm)} · linha reta
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
