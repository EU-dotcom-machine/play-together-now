import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { distanceKm } from "@/lib/geo";
import { trackEvent } from "@/lib/posthog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/new")({
  head: () => ({ meta: [{ title: "Criar jogo — Esportes Unidos" }] }),
  component: NewGame,
});

type Coords = { lat: number; lng: number };
type Suggestion = { display_name: string; lat: string; lon: string };

function NewGame() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [sportId, setSportId] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [slots, setSlots] = useState("");
  const [price, setPrice] = useState("");
  const [urgency, setUrgency] = useState<"relaxado" | "normal" | "urgente">("normal");
  const [visibility, setVisibility] = useState<"public" | "friends" | "cep">("public");
  const [cep, setCep] = useState("");
  const [description, setDescription] = useState("");
  const [gpsCoords, setGpsCoords] = useState<Coords | null>(null);
  const [addressCoords, setAddressCoords] = useState<Coords | null>(null);
  const [source, setSource] = useState<"gps" | "address">("gps");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAddrCoords, setPendingAddrCoords] = useState<Coords | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setGpsCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
    );
  }, []);

  // Debounced suggestion fetch (no dialog while typing)
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const addr = venueAddress.trim();
    if (addr.length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=5&countrycodes=br`,
          { headers: { "Accept-Language": "pt-BR" } },
        );
        const data = await res.json();
        if (Array.isArray(data)) {
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
        }
      } catch {
        setSuggestions([]);
      }
    }, 800);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [venueAddress]);

  function selectSuggestion(s: Suggestion) {
    const found: Coords = { lat: parseFloat(s.lat), lng: parseFloat(s.lon) };
    justSelectedRef.current = true;
    setVenueAddress(s.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    if (!isFinite(found.lat) || !isFinite(found.lng)) return;
    setAddressCoords(found);
    if (gpsCoords) {
      const d = distanceKm(gpsCoords.lat, gpsCoords.lng, found.lat, found.lng);
      if (d > 0.5) {
        setPendingAddrCoords(found);
        setConfirmOpen(true);
        return;
      }
    }
    setSource("address");
  }

  const { data: sports } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id,name,emoji").order("name");
      return data ?? [];
    },
  });

  // Prefill CEP from host profile when "cep" visibility is chosen
  useEffect(() => {
    if (visibility !== "cep" || !user || cep) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("cep").eq("id", user.id).single();
      const c = (data as any)?.cep as string | null;
      if (c) setCep(c);
    })();
  }, [visibility, user, cep]);

  const effectiveCoords: Coords | null =
    source === "address" && addressCoords ? addressCoords : gpsCoords;

  async function geocodeOnce(addr: string): Promise<Coords | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1&countrycodes=br`,
        { headers: { "Accept-Language": "pt-BR" } },
      );
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const c = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      return isFinite(c.lat) && isFinite(c.lng) ? c : null;
    } catch {
      return null;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    let coords = effectiveCoords;
    if (!coords && venueAddress.trim().length >= 4) {
      coords = await geocodeOnce(venueAddress.trim());
    }
    if (!coords) {
      toast.error("Precisamos da sua localização pra criar o jogo");
      return;
    }
    const slotsNum = Math.max(1, parseInt(slots || "10", 10) || 10);
    const priceNum = price.trim() === "" ? 0 : parseFloat(price) || 0;

    setSaving(true);
    try {
      const { data: venue, error: vErr } = await supabase
        .from("venues")
        .insert({
          created_by: user.id,
          name: venueName,
          address: venueAddress || null,
          latitude: coords.lat,
          longitude: coords.lng,
        })
        .select("id")
        .single();
      if (vErr) throw vErr;

      const { data: game, error: gErr } = await supabase
        .from("games")
        .insert({
          host_id: user.id,
          sport_id: sportId,
          venue_id: venue.id,
          title,
          description: description || null,
          starts_at: new Date(startsAt).toISOString(),
          slots_total: slotsNum,
          price_cents: Math.round(priceNum * 100),
          urgency,
          visibility,
          cep: visibility === "cep" ? cep.replace(/\D/g, "").slice(0, 8) || null : null,
          latitude: coords.lat,
          longitude: coords.lng,
        } as any)
        .select("id")
        .single();
      if (gErr) throw gErr;

      toast.success("Jogo criado!");
      trackEvent("game_created", { game_id: game.id });
      navigate({ to: "/games/$id", params: { id: game.id } });
    } catch (err: any) {
      toast.error(err?.message ?? "Não rolou");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="px-5 pt-8 max-w-md mx-auto">
      <h1 className="text-4xl font-extrabold uppercase leading-none">
        Criar jogo<span className="text-pop">.</span>
      </h1>
      <p className="mt-1 text-sm text-ink/70">Preencha rapidinho. Quem tá perto vai ver.</p>

      <form onSubmit={submit} className="mt-6 grid gap-3">
        <Field label="Título">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input-brutal" placeholder="Pelada noturna" />
        </Field>

        <Field label="Esporte">
          <select required value={sportId} onChange={(e) => setSportId(e.target.value)} className="input-brutal">
            <option value="">Escolha…</option>
            {sports?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Local / quadra">
          <input required value={venueName} onChange={(e) => setVenueName(e.target.value)} className="input-brutal" placeholder="Quadra do Zé" />
        </Field>
        <Field label="Endereço (opcional)">
          <div className="relative">
            <input
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="input-brutal w-full"
              placeholder="Rua, número, bairro"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-[10px] border bg-[#1E1E1E] border-[#2A2A2A] text-white max-h-64 overflow-auto shadow-lg">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSuggestion(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#2A2A2A]"
                    >
                      {s.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>

        <div className="inline-flex items-center gap-1.5 w-fit rounded-full px-3 py-1.5 bg-pop text-[#111] text-xs font-bold uppercase">
          <MapPin className="size-3.5" />
          {effectiveCoords
            ? `Localização capturada · ${source === "address" ? "endereço" : "GPS"}`
            : "Aguardando GPS…"}
        </div>


        <Field label="Quando">
          <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="input-brutal" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vagas (além de você)">
            <input
              required
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={slots}
              placeholder="10"
              onChange={(e) => setSlots(e.target.value.replace(/^0+(?=\d)/, ""))}
              className="input-brutal"
            />
          </Field>
          <Field label="Valor (R$)">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={price}
              placeholder="0"
              onChange={(e) => setPrice(e.target.value.replace(/^0+(?=\d)/, ""))}
              className="input-brutal"
            />
          </Field>
        </div>

        <Field label="Urgência">
          <div className="grid grid-cols-3 gap-2">
            {(["relaxado", "normal", "urgente"] as const).map((u) => {
              const isActive = urgency === u;
              const activeCls =
                u === "urgente"
                  ? "bg-[#FF4444] text-white border-[#FF4444]"
                  : u === "normal"
                    ? "bg-[#FFD600] text-[#111] border-[#FFD600]"
                    : "bg-[#2D6A4F] text-white border-[#2D6A4F]";
              const inactiveCls = "bg-[#1E1E1E] border-[#2A2A2A] text-[#888]";
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`rounded-[10px] border py-2.5 text-xs font-bold uppercase tracking-wide ${isActive ? activeCls : inactiveCls}`}
                >
                  {u}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Detalhes">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-brutal min-h-24" placeholder="Nível, regras, o que levar…" />
        </Field>

        <button
          disabled={saving}
          className="btn-primary-pill mt-2 flex items-center justify-center gap-2 active:opacity-90 disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Publicar jogo
        </button>

      </form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Endereço diferente da sua posição</AlertDialogTitle>
            <AlertDialogDescription>
              Você está em outro lugar agora. Usar o endereço digitado como local do jogo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSource("gps");
                setPendingAddrCoords(null);
              }}
            >
              Usar minha posição
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingAddrCoords) setAddressCoords(pendingAddrCoords);
                setSource("address");
                setPendingAddrCoords(null);
              }}
            >
              Usar endereço
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="section-label">{label}</span>
      {children}
    </label>
  );
}
