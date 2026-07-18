import { createFileRoute, Link, Navigate, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateDisplay } from "@/lib/utils";
import { MapPin, Users, CalendarDays, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { VerifiedBadge } from "@/components/verified-badge";

type Venue = {
  id: string;
  name: string | null;
  address: string | null;
  description: string | null;
  phone: string | null;
  instagram: string | null;
  is_public: boolean | null;
  is_verified: boolean | null;
  owner_id: string | null;
};

export const Route = createFileRoute("/_app/venue-panel")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel do Espaço — Esportes Unidos" }] }),
  component: VenuePanel,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: owned } = await supabase
      .from("venues")
      .select("id")
      .eq("owner_id" as any, user.id)
      .limit(1)
      .maybeSingle();
    if (owned) return;
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
  const qc = useQueryClient();

  const { data: venue, isLoading: venueLoading } = useQuery({
    queryKey: ["my-venue", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Venue | null> => {
      const cols = "id,name,address,description,phone,instagram,is_public,is_verified,owner_id";
      const { data: owned } = await (supabase as any)
        .from("venues")
        .select(cols)
        .eq("owner_id", user!.id)
        .limit(1)
        .maybeSingle();
      if (owned) return owned as Venue;
      const { data: claim } = await (supabase as any)
        .from("venue_claims")
        .select(`venues:venue_id(${cols})`)
        .eq("claimant_id", user!.id)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();
      return ((claim as any)?.venues ?? null) as Venue | null;
    },
  });

  const venueId = venue?.id;
  const isOwner = !!venue && venue.owner_id === user?.id;

  // Formulário de edição (só para o dono aprovado).
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (venue && !hydrated) {
      setName(venue.name ?? "");
      setDescription(venue.description ?? "");
      setPhone(venue.phone ?? "");
      setInstagram(venue.instagram ?? "");
      setIsPublic(venue.is_public ?? true);
      setHydrated(true);
    }
  }, [venue, hydrated]);

  async function save() {
    if (!venueId) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("venues")
      .update({
        name: name.trim() || venue?.name,
        description: description.trim() || null,
        phone: phone.trim() || null,
        instagram: instagram.trim().replace(/^@/, "") || null,
        is_public: isPublic,
      })
      .eq("id", venueId);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Espaço atualizado!");
    qc.invalidateQueries({ queryKey: ["my-venue", user?.id] });
  }

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
      const { data } = await (supabase as any)
        .from("profiles_public")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      const map: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      for (const p of data ?? []) map[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
      return map;
    },
  });

  if (!user) return null;
  if (venueLoading) return <div className="px-5 py-8 text-ink/60">Carregando…</div>;
  if (!venue) return <Navigate to="/profile" replace />;

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
      display_name: profilesMap?.[id]?.display_name ?? "Atleta",
      avatar_url: profilesMap?.[id]?.avatar_url ?? null,
    }));

  return (
    <main className="px-5 py-6 max-w-3xl mx-auto overflow-y-auto max-h-screen pb-24">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Painel do Espaço</p>
        <h1 className="text-3xl font-extrabold uppercase leading-tight flex items-center gap-2">
          <span className="min-w-0 truncate">{venue.name ?? "Seu espaço"}</span>
          {venue.is_verified && <VerifiedBadge />}
        </h1>
        {venue.address && (
          <p className="mt-1 flex items-center gap-1 text-sm text-ink/70">
            <MapPin className="size-4 shrink-0" /> {venue.address}
          </p>
        )}
      </header>

      <section className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="Atividades" value={totalGames} />
        <Stat label="Presenças" value={totalConfirmed} />
        <Stat label="Atletas únicos" value={uniquePlayers} />
      </section>

      {/* EDIÇÃO — só para o dono aprovado */}
      {isOwner && (
        <section className="mb-8 brutal-card-lg p-4 grid gap-4">
          <h2 className="text-base font-bold uppercase tracking-wide">Editar espaço</h2>
          <Field label="Nome">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-brutal" />
          </Field>
          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-brutal min-h-20"
              placeholder="Conte sobre o espaço, estrutura, horários…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-brutal" placeholder="(11) 90000-0000" />
            </Field>
            <Field label="Instagram">
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className="input-brutal" placeholder="@seuespaco" />
            </Field>
          </div>
          <label className="flex items-center justify-between gap-3 bg-surface rounded-xl px-4 py-3">
            <span className="text-sm font-semibold">Visível na busca de estabelecimentos</span>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="size-5 accent-[#FFD600]"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="brutal-card-lg px-5 py-4 bg-pop text-primary-foreground font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar
          </button>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-base font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
          <CalendarDays className="size-4" /> Atividades no espaço
        </h2>
        {totalGames === 0 ? (
          <p className="text-sm text-ink/60">Nenhuma atividade criada ainda.</p>
        ) : (
          <div className="grid gap-3">
            {games!.map((g: any) => {
              const confirmed = (g.participants ?? []).filter((p: any) => p.status === "confirmed").length;
              const date = formatDateDisplay(g.starts_at, {
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
                          {g.sport?.emoji} {g.sport?.name ?? "Atividade"}
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
                    <span className="text-sm font-bold">{f.count}× atividades</span>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-ink/60">{label}</span>
      {children}
    </label>
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
