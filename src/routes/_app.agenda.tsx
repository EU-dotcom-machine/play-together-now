import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getCourtImage } from "@/lib/sport-courts";
import { MapPin, Users, Loader2, Zap } from "lucide-react";
import { cn, formatDateDisplay } from "@/lib/utils";
import { VisibilityBadge } from "@/components/visibility-badge";

export const Route = createFileRoute("/_app/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Esportes Unidos" }] }),
  component: Agenda,
});

type AgendaGame = {
  id: string;
  title: string;
  starts_at: string;
  slots_total: number;
  price_cents: number;
  urgency: "relaxado" | "normal" | "urgente";
  latitude: number;
  longitude: number;
  sport_id: string | null;
  visibility: "public" | "friends" | "cep";
  sports: { name: string; emoji: string } | null;
  venues: { name: string } | null;
  participants_count: number;
};

function Agenda() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { data: upcoming = [], isLoading: loadingUp } = useQuery({
    queryKey: ["agenda-upcoming", user?.id],
    enabled: !!user,
    queryFn: async () => fetchAgenda(user!.id, "upcoming"),
  });

  const { data: past = [], isLoading: loadingPast } = useQuery({
    queryKey: ["agenda-past", user?.id],
    enabled: !!user,
    queryFn: async () => fetchAgenda(user!.id, "past"),
  });

  const upcomingGrouped = useMemo(() => groupByDate(upcoming), [upcoming]);

  return (
    <main className="px-5 pt-8 pb-4 max-w-md mx-auto">
      <header>
        <h1 className="text-4xl font-extrabold uppercase leading-none">
          Agenda<span className="text-pop">.</span>
        </h1>
        <p className="mt-1 text-sm text-ink/70">Suas atividades confirmadas</p>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2 rounded-full text-xs font-bold uppercase transition-colors",
              tab === t ? "bg-pop text-[#111]" : "bg-[#1E1E1E] text-ink/70",
            )}
          >
            {t === "upcoming" ? "Próximas" : "Histórico"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {tab === "upcoming" && (
          <>
            {loadingUp && (
              <div className="flex items-center justify-center py-12 text-ink/60">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
            {!loadingUp && upcoming.length === 0 && (
              <EmptyState text="Sem atividades confirmadas. Encontre uma em Atividades!" />
            )}
            {upcomingGrouped.map(([date, games]) => (
              <section key={date} className="grid gap-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink/60">{date}</h2>
                {games.map((g) => (
                  <GameCard key={g.id} game={g} />
                ))}
              </section>
            ))}
          </>
        )}

        {tab === "past" && (
          <>
            {loadingPast && (
              <div className="flex items-center justify-center py-12 text-ink/60">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
            {!loadingPast && past.length === 0 && (
              <EmptyState text="Ainda nada por aqui. Suas atividades passadas aparecerão aqui." />
            )}
            {past.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </>
        )}
      </div>
    </main>
  );
}

async function fetchAgenda(userId: string, kind: "upcoming" | "past"): Promise<AgendaGame[]> {
  const nowIso = new Date().toISOString();

  // Games where I'm a confirmed participant
  let partQuery = supabase
    .from("game_participants")
    .select(
      "game_id, games!inner(id,title,starts_at,slots_total,price_cents,urgency,latitude,longitude,sport_id,venue_id,visibility,status,sports(name,emoji),venues(name))" as any,
    )
    .eq("user_id", userId)
    .eq("status" as any, "confirmed");

  // Games I host (regardless of visibility) — covers cases where host is not auto-added as participant
  let hostQuery = supabase
    .from("games")
    .select(
      "id,title,starts_at,slots_total,price_cents,urgency,latitude,longitude,sport_id,venue_id,visibility,status,sports(name,emoji),venues(name)" as any,
    )
    .eq("host_id", userId);

  if (kind === "upcoming") {
    partQuery = partQuery
      .gte("games.starts_at" as any, nowIso)
      .in("games.status" as any, ["open", "full"])
      .order("games(starts_at)" as any, { ascending: true });
    hostQuery = hostQuery
      .gte("starts_at", nowIso)
      .in("status", ["open", "full"])
      .order("starts_at", { ascending: true });
  } else {
    partQuery = partQuery
      .lt("games.starts_at" as any, nowIso)
      .order("games(starts_at)" as any, { ascending: false });
    hostQuery = hostQuery
      .lt("starts_at", nowIso)
      .order("starts_at", { ascending: false });
  }

  const [partRes, hostRes] = await Promise.all([partQuery, hostQuery]);
  if (partRes.error) throw partRes.error;
  if (hostRes.error) throw hostRes.error;

  // Merge & dedupe
  const partRows = ((partRes.data ?? []) as any[]).map((r) => r.games).filter(Boolean);
  const hostRows = (hostRes.data ?? []) as any[];
  const byId = new Map<string, any>();
  for (const r of [...partRows, ...hostRows]) byId.set(r.id, r);
  const rows = Array.from(byId.values());
  if (rows.length === 0) return [];

  rows.sort((a, b) =>
    kind === "upcoming"
      ? new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      : new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
  );

  // Hydrate participants_count
  const ids = rows.map((r: any) => r.id);
  const { data: parts } = await supabase
    .from("game_participants")
    .select("game_id")
    .in("game_id", ids)
    .eq("status" as any, "confirmed");
  const counts = new Map<string, number>();
  for (const p of (parts ?? []) as any[]) {
    counts.set(p.game_id, (counts.get(p.game_id) ?? 0) + 1);
  }
  return rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    starts_at: r.starts_at,
    slots_total: r.slots_total,
    price_cents: r.price_cents,
    urgency: r.urgency,
    latitude: r.latitude,
    longitude: r.longitude,
    sport_id: r.sport_id,
    visibility: r.visibility ?? "public",
    sports: r.sports ?? null,
    venues: r.venues ?? null,
    participants_count: counts.get(r.id) ?? 0,
  }));
}

function groupByDate(games: AgendaGame[]): [string, AgendaGame[]][] {
  const map = new Map<string, AgendaGame[]>();
  for (const g of games) {
    const d = new Date(g.starts_at);
    const key = formatDateDisplay(d, { weekday: "short", day: "2-digit", month: "short" })
      .replace(/\./g, "")
      .toUpperCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  }
  return Array.from(map.entries());
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="brutal-card p-6 text-center">
      <p className="text-sm text-ink/70">{text}</p>
    </div>
  );
}

const sportColor: Record<string, string> = {
  Futebol: "#00b140",
  Futsal: "#00b140",
  Society: "#00b140",
  Basquete: "#ff6b00",
  Vôlei: "#0066cc",
  "Vôlei de Praia": "#f5a623",
  "Beach Tennis": "#f5a623",
  Tênis: "#7bc043",
  Padel: "#00c9a7",
};

function GameCard({ game }: { game: AgendaGame }) {
  const borderColor = sportColor[game.sports?.name ?? ""] ?? "#FFD600";
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
            <h3
              className="text-white font-bold leading-tight inline-flex items-center gap-1.5"
              style={{ fontSize: "15px" }}
            >
              <VisibilityBadge visibility={game.visibility} />
              {game.title}
            </h3>
          </div>
        </div>
        {game.urgency === "urgente" && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-[#FF4444] text-white text-xs"
            style={{ fontWeight: 800 }}
          >
            <Zap className="size-3" /> URGENTE
          </span>
        )}
      </div>

      <div className="relative z-10 mt-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-[#2A2A2A] text-white">
          <MapPin className="size-3" />
          {game.venues?.name ?? "Sem local"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-[#2A2A2A] text-white">
          {formatDateDisplay(start, { weekday: "short", day: "2-digit", month: "2-digit" })}{" "}
          {formatDateDisplay(start, { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-[#2A2A2A] text-white">
          <Users className="size-3" />
          {filled}/{game.slots_total}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold",
            free ? "bg-[#FFD600] text-[#111]" : "bg-[#2A2A2A] text-white",
          )}
        >
          {free ? "DE GRAÇA" : `R$ ${(game.price_cents / 100).toFixed(2)}`}
        </span>
      </div>
    </Link>
  );
}
