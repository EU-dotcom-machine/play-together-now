import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { LogOut, Save, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Perfil — PEGA" }] }),
  component: Profile,
});

const YEARS = ["<1 ano", "1-3 anos", "3-5 anos", "5-10 anos", "10+ anos"] as const;
const SIDES = ["Destro", "Canhoto", "Ambidestro"] as const;
const LEVELS = ["Iniciante", "Intermediário", "Avançado", "Profissional"] as const;

const BRANDS: { id: string; name: string; color: string | null }[] = [
  { id: "none", name: "Nenhum", color: null },
  { id: "nike", name: "Nike", color: "#111111" },
  { id: "adidas", name: "Adidas", color: "#000000" },
  { id: "puma", name: "Puma", color: "#CC0000" },
  { id: "under-armour", name: "Under Armour", color: "#1A1A2E" },
  { id: "new-balance", name: "New Balance", color: "#CF0A2C" },
  { id: "asics", name: "Asics", color: "#1A3A5C" },
  { id: "olympikus", name: "Olympikus", color: "#F5A623" },
  { id: "mizuno", name: "Mizuno", color: "#003087" },
  { id: "penalty", name: "Penalty", color: "#006400" },
  { id: "topper", name: "Topper", color: "#8B0000" },
];

function positionsForSport(name: string): string[] {
  const n = name.toLowerCase();
  if (/(futebol|futsal|society)/.test(n))
    return ["Goleiro", "Zagueiro", "Lateral", "Volante", "Meia", "Atacante"];
  if (/basquete/.test(n)) return ["Armador", "Ala", "Pivô"];
  if (/v[oô]lei/.test(n)) return ["Levantador", "Líbero", "Ponteiro", "Central", "Oposto"];
  if (/(t[eê]nis|padel|beach)/.test(n)) return ["Simples", "Duplas"];
  return [];
}

function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
  });

  const { data: sports } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id,name,emoji").order("name");
      return data ?? [];
    },
  });

  const [display, setDisplay] = useState("");
  const [bio, setBio] = useState("");
  const [weight, setWeight] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [years, setYears] = useState<string | null>(null);
  const [side, setSide] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [sportIds, setSportIds] = useState<string[]>([]);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [brandId, setBrandId] = useState<string>("none");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (profile && !hydrated) {
      setDisplay(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setWeight(profile.weight_kg ? String(profile.weight_kg) : "");
      setHeight(profile.height_cm ? String(profile.height_cm) : "");
      setYears(profile.years_playing ?? null);
      setSide(profile.dominant_side ?? null);
      setLevel(profile.skill_level ?? null);
      setSportIds((profile as any).sport_ids ?? []);
      setPositions(((profile as any).sport_positions ?? {}) as Record<string, string>);
      setBrandId(((profile as any).sponsor_brand as string) || "none");
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const selectedBrand = useMemo(
    () => BRANDS.find((b) => b.id === brandId) ?? BRANDS[0],
    [brandId],
  );

  const selectedSports = useMemo(
    () => (sports ?? []).filter((s: any) => sportIds.includes(s.id)),
    [sports, sportIds],
  );

  function toggleSport(id: string) {
    setSportIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function save() {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: display,
        bio,
        weight_kg: weight ? Number(weight) : null,
        height_cm: height ? Number(height) : null,
        years_playing: years,
        dominant_side: side,
        skill_level: level,
        sport_ids: sportIds,
        sport_positions: positions,
        sponsor_brand: brandId === "none" ? null : brandId,
      } as any)
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil salvo!");
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  async function selectBrand(id: string) {
    setBrandId(id);
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ sponsor_brand: id === "none" ? null : id } as any)
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <main className="max-w-md mx-auto pb-24">
      {/* Header with brand color background or default dark gradient + yellow username */}
      <header
        className="px-5 pt-10 pb-12 transition-colors"
        style={
          selectedBrand.color
            ? { background: selectedBrand.color }
            : { background: "linear-gradient(180deg, #111111 0%, #1E1E1E 100%)" }
        }
      >
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-pop text-[#111] flex items-center justify-center text-2xl font-extrabold">
            {display?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-[#888]">jogador</p>
            <h1 className="text-2xl font-extrabold leading-none text-pop">{display || "—"}</h1>
          </div>
        </div>

        <div className="mt-5 inline-flex items-center gap-1.5 bg-pop text-[#111] px-3 py-1.5 rounded-full text-xs font-bold">
          <Trophy className="size-3.5" /> {profile?.points ?? 0} pontos
        </div>
      </header>

      <section className="px-5 py-6 grid gap-4">
        <Field label="Nome">
          <input value={display} onChange={(e) => setDisplay(e.target.value)} className="input-brutal" />
        </Field>
        <Field label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="input-brutal min-h-20"
            placeholder="Joga o quê, em que nível…"
          />
        </Field>

        {/* Patrocinador */}
        <SectionTitle>Patrocinador (estilo do perfil)</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {BRANDS.map((b) => {
            const selected = brandId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => selectBrand(b.id)}
                className="rounded-xl p-4 text-left font-bold text-white transition-all"
                style={{
                  background: b.color ?? "#1E1E1E",
                  border: selected ? "2px solid #FFD600" : "2px solid transparent",
                  boxShadow: selected ? "0 0 0 2px rgba(255,214,0,0.25)" : "none",
                }}
              >
                <span className="text-xs uppercase tracking-wider text-white/70 block">
                  Marca
                </span>
                <span className="text-base">{b.name}</span>
              </button>
            );
          })}
        </div>

        {/* Sobre você */}
        <SectionTitle>Sobre você</SectionTitle>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso (kg)">
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="input-brutal"
              placeholder="72"
            />
          </Field>
          <Field label="Altura (cm)">
            <input
              type="number"
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="input-brutal"
              placeholder="178"
            />
          </Field>
        </div>

        <Field label="Tempo jogando">
          <ChipRow options={YEARS as unknown as string[]} value={years} onChange={setYears} />
        </Field>

        <Field label="Lado dominante">
          <ChipRow options={SIDES as unknown as string[]} value={side} onChange={setSide} />
        </Field>

        <Field label="Nível">
          <ChipRow options={LEVELS as unknown as string[]} value={level} onChange={setLevel} />
        </Field>

        {/* Esportes selection */}
        <SectionTitle>Seus esportes</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {(sports ?? []).map((s: any) => {
            const on = sportIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSport(s.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors",
                  on
                    ? "bg-pop text-[#111] border-pop"
                    : "bg-surface text-foreground border-border",
                )}
              >
                <span className="mr-1">{s.emoji}</span>
                {s.name}
              </button>
            );
          })}
        </div>

        {/* Por esporte */}
        {selectedSports.length > 0 && (
          <>
            <SectionTitle>Por esporte</SectionTitle>
            <div className="grid gap-3">
              {selectedSports.map((s: any) => {
                const opts = positionsForSport(s.name);
                return (
                  <div
                    key={s.id}
                    className="bg-surface border border-border rounded-2xl p-4 relative overflow-hidden"
                  >
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-pop" />
                    <p className="text-sm font-bold flex items-center gap-2">
                      <span className="text-lg">{s.emoji}</span> {s.name}
                    </p>
                    {opts.length > 0 ? (
                      <select
                        value={positions[s.id] ?? ""}
                        onChange={(e) =>
                          setPositions((p) => ({ ...p, [s.id]: e.target.value }))
                        }
                        className="input-brutal mt-2"
                      >
                        <option value="">Posição preferida…</option>
                        {opts.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-2 text-xs text-[#888]">
                        Sem posições específicas pra esse esporte.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={save}
          className="mt-4 px-5 py-4 bg-pop text-[#111] font-bold uppercase rounded-full flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(255,214,0,0.25)] active:translate-y-[1px]"
        >
          <Save className="size-4" /> Salvar
        </button>
        <button
          onClick={signOut}
          className="px-5 py-3 bg-transparent border border-pop text-pop font-bold uppercase rounded-full flex items-center justify-center gap-2"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </section>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold uppercase tracking-wide text-foreground mt-2">
      {children}
    </h2>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors",
              on ? "bg-pop text-[#111] border-pop" : "bg-surface text-foreground border-border",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-[#888]">{label}</span>
      {children}
    </label>
  );
}
