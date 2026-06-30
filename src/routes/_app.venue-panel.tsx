import { createFileRoute, Link, Navigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_app/venue-panel")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel do Espaço — Esportes Unidos" }] }),
  component: VenuePanel,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: claim } = await supabase
      .from("venue_claims")
      .select("id")
      .eq("claimant_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();
    if (!claim) throw redirect({ to: "/profile" });
  },
});

function VenuePanel() {
  const { user } = useAuth();

  const { data: claim, isLoading: claimLoading } = useQuery({
    queryKey: ["my-accepted-claim-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("venue_claims")
        .select("id, venue_id, venues:venue_id(id,name,address)")
        .eq("claimant_id", user!.id)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const venueId = claim?.venue_id as string | undefined;

  const { data: games } = useQuery({
    queryKey: ["venue-panel-games", venueId],
    enabled: !!venueId,
    queryFn: async () => {
      const { data } = await supabase
        .from("games")
        .select("id, starts_at, slots_total, sport:sport_id(name,emoji), participants:game_participants(user_id,status)")
        .eq("venue_id", venueId!)
        .order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profilesMap } = useQuery({
    queryKey: ["venue-panel-profiles", venueId, (games ?? []).length],
    enabled: !!games && games.length > 0,
    queryFn: async () => {
      const ids = Array.from(
        new Set(
          (games ?? []).flatMap((g: any) =>
            (g.participants ?? []).filter((p: any) => p.status === "confirmed").map((p: any) => p.user_id),
          ),
        ),
      );
      if (ids.length === 0) return {} as Record<string, { display_name: string | null; avatar_url: string | null }>;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      const map: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      for (const p of data ?? []) map[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
      return map;
    },
  });

  if (!user) return null;
  if (claimLoading) return <div className="px-5 py-8 text-ink/60">Carregando…</div>;
  if (!claim) return <Navigate to="/profile" replace />;

  const totalGames = games?.length ?? 0;
  let totalConfirmed = 0;
  const playerCounts = new Map<string, number>();
  for (const g of games ?? []) {
    const confirmed = (g.participants ?? []).filter((p: any) => p.status === "confirmed");
    totalConfirmed += confirmed.length;
    for (const p of confirmed) {
      playerCounts.set(p.user_id, (playerCounts.get(p.user_id) ?? 0) + 1);
    }
  }
  const uniquePlayers = playerCounts.size;
  const frequenters = Array.from(playerCounts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      id,
      count,
      display_name: profilesMap?.[id]?.display_name ?? "Jogador",
      avatar_url: profilesMap?.[id]?.avatar_url ?? null,
    }));

  const venueName = (claim as any).venues?.name ?? "Seu espaço";

  return (
    <main className="px-5 py-6 max-w-3xl mx-auto overflow-y-auto max-h-screen">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Painel do Espaço</p>
        <h1 className="text-3xl font-extrabold uppercase leading-tight">{venueName}</h1>
        {(claim as any).venues?.address && (
          <p className="mt-1 flex items-center gap-1 text-sm text-ink/70">
            <MapPin className="size-4" /> {(claim as any).venues.address}
          </p>
        )}
      </header>

      <section className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="Jogos" value={totalGames} />
        <Stat label="Presenças" value={totalConfirmed} />
        <Stat label="Jogadores únicos" value={uniquePlayers} />
      </section>

      <section className="mb-8">
        <h2 className="text-base font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
          <CalendarDays className="size-4" /> Jogos no espaço
        </h2>
        {totalGames === 0 ? (
          <p className="text-sm text-ink/60">Nenhum jogo criado ainda.</p>
        ) : (
          <div className="grid gap-3">
            {games!.map((g: any) => {
              const confirmed = (g.participants ?? []).filter((p: any) => p.status === "confirmed").length;
              const date = new Date(g.starts_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <Link key={g.id} to="/games/$id" params={{ id: g.id }}>
                  <Card>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold truncate">
                          {g.sport?.emoji} {g.sport?.name ?? "Jogo"}
                        </p>
                        <p className="text-xs text-ink/60 mt-0.5">{date}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">
                          {confirmed}/{g.slots_total ?? "-"}
                        </p>
                        <p className="text-[10px] uppercase text-ink/60">confirmados</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
          <Users className="size-4" /> Frequentadores
        </h2>
        {frequenters.length === 0 ? (
          <p className="text-sm text-ink/60">Ainda sem frequentadores recorrentes.</p>
        ) : (
          <div className="grid gap-2">
            {frequenters.map((f) => (
              <Link key={f.id} to="/profile/$id" params={{ id: f.id }}>
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    {f.avatar_url ? (
                      <img src={f.avatar_url} alt="" className="size-10 rounded-full object-cover" />
                    ) : (
                      <div className="size-10 rounded-full bg-ink/10 grid place-items-center text-sm font-bold">
                        {(f.display_name ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <p className="flex-1 font-semibold truncate">{f.display_name}</p>
                    <span className="text-sm font-bold">{f.count}× jogos</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <p className="text-2xl font-extrabold">{value}</p>
      </CardContent>
    </Card>
  );
}
