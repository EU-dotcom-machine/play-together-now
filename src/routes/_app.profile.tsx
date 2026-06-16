import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { LogOut, Save, Trophy, MapPin, RefreshCw, ChevronDown, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog";
import { brandGradient } from "@/lib/brands";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Perfil — Esportes Unidos" }] }),
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
  const [cep, setCep] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sportsOpen, setSportsOpen] = useState(false);
  const [bySportOpen, setBySportOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    try {
      // Resize/compress to max 400x400 via canvas
      const blob = await resizeImage(file, 400);
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url } as any)
        .eq("id", user.id);
      if (updErr) throw updErr;
      toast.success("Foto atualizada!");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  }

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
      setCep(((profile as any).cep as string) ?? "");
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
        cep: cep.trim() ? cep.replace(/\D/g, "").slice(0, 8) : null,
      } as any)
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil salvo!");
    trackEvent("profile_updated");
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

  async function updateLocation() {
    if (!user) return;
    if (!navigator.geolocation) return toast.error("Geolocalização indisponível");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const { error } = await supabase
          .from("profiles")
          .update({ latitude: p.coords.latitude, longitude: p.coords.longitude } as any)
          .eq("id", user.id);
        if (error) return toast.error(error.message);
        toast.success("Localização atualizada!");
        qc.invalidateQueries({ queryKey: ["profile", user.id] });
      },
      () => toast.error("Não foi possível obter sua localização"),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5000 },
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <main className="max-w-md mx-auto pb-24">
      {/* Header with brand color background or default dark gradient + yellow username */}
      <header
        className="px-5 pt-10 pb-12 transition-colors"
        style={{ background: brandGradient(selectedBrand.name) }}
      >
        <div className="flex items-center gap-4">
          <div className="relative size-16 shrink-0">
            <div className="size-16 rounded-full bg-pop text-[#111] flex items-center justify-center text-2xl font-extrabold overflow-hidden">
              {(profile as any)?.avatar_url ? (
                <img
                  src={(profile as any).avatar_url}
                  alt=""
                  className="size-16 rounded-full object-cover"
                />
              ) : (
                display?.[0]?.toUpperCase() ?? "?"
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Trocar foto"
              className="absolute -bottom-0.5 -right-0.5 size-5 bg-pop text-[#111] rounded-full p-0.5 cursor-pointer border border-[#111] flex items-center justify-center disabled:opacity-60"
            >
              <Camera className="size-3" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarFile}
            />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-[#888]">jogador</p>
            <h1 className="text-2xl font-extrabold leading-none text-pop">{display || "—"}</h1>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 bg-pop text-[#111] px-3 py-1.5 rounded-full text-xs font-bold">
            <Trophy className="size-3.5" /> {profile?.points ?? 0} pontos
          </div>
          <div className="inline-flex items-center gap-2 bg-black/30 text-white px-3 py-1.5 rounded-full text-xs">
            <MapPin className="size-3.5" />
            {(profile as any)?.latitude != null
              ? "Localização salva"
              : "Sem localização"}
            <button
              type="button"
              onClick={updateLocation}
              className="ml-1 inline-flex items-center gap-1 bg-pop text-[#111] px-2 py-0.5 rounded-full font-bold uppercase"
            >
              <RefreshCw className="size-3" /> Atualizar
            </button>
          </div>
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
        <Collapsible open={sponsorOpen} onOpenChange={setSponsorOpen}>
          <CollapsibleTrigger className="w-full flex items-center justify-between bg-[#1E1E1E] rounded-xl px-4 py-3 cursor-pointer text-left">
            <span className="text-base font-bold uppercase tracking-wide text-foreground">
              Patrocinador (estilo do perfil)
            </span>
            <ChevronDown
              className={cn("size-5 transition-transform duration-200", sponsorOpen && "rotate-180")}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
            <div className="grid grid-cols-2 gap-3 pt-3">
              {BRANDS.map((b) => {
                const selected = brandId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => selectBrand(b.id)}
                    className={cn(
                      "relative overflow-hidden rounded-xl p-4 text-left transition-all border-2",
                      selected
                        ? "border-[#FFD600] shadow-[0_0_0_2px_rgba(255,214,0,0.25)]"
                        : "border-[#2A2A2A]",
                    )}
                    style={{ background: b.id === "none" ? "#1E1E1E" : brandGradient(b.name) }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)" }}
                    />
                    <div className="relative z-10">
                      <span className="text-[10px] uppercase tracking-wider text-white/70 block">
                        Marca
                      </span>
                      <span className="text-white font-extrabold text-base">{b.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

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

        <Field label="CEP">
          <input
            inputMode="numeric"
            maxLength={8}
            value={cep}
            onChange={(e) => setCep(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className="input-brutal"
            placeholder="00000000"
          />
        </Field>



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
        <Collapsible open={sportsOpen} onOpenChange={setSportsOpen}>
          <CollapsibleTrigger className="w-full flex items-center justify-between bg-[#1E1E1E] rounded-xl px-4 py-3 cursor-pointer text-left">
            <span className="text-base font-bold uppercase tracking-wide text-foreground">Seus esportes</span>
            <ChevronDown
              className={cn("size-5 transition-transform duration-200", sportsOpen && "rotate-180")}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
            <div className="flex flex-wrap gap-2 pt-3">
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
          </CollapsibleContent>
        </Collapsible>

        {/* Por esporte */}
        {selectedSports.length > 0 && (
          <Collapsible open={bySportOpen} onOpenChange={setBySportOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between bg-[#1E1E1E] rounded-xl px-4 py-3 cursor-pointer text-left">
              <span className="text-base font-bold uppercase tracking-wide text-foreground">Por esporte</span>
              <ChevronDown
                className={cn("size-5 transition-transform duration-200", bySportOpen && "rotate-180")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
              <div className="grid gap-3 pt-3">
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
            </CollapsibleContent>
          </Collapsible>
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

async function resizeImage(file: File, max: number): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("image load failed"));
    i.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b ?? file),
      "image/jpeg",
      0.85,
    );
  });
}
