import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, MapPin, AlertTriangle, Search } from "lucide-react";
import { trackEvent } from "@/lib/posthog";

export const Route = createFileRoute("/_app/new")({
  head: () => ({ meta: [{ title: "Criar jogo — Esportes Unidos" }] }),
  component: NewGame,
});

type Coords = { lat: number; lng: number };
type Suggestion = { display_name: string; place_id: string };

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string | undefined;


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
  const [addressLabel, setAddressLabel] = useState<string>("");
  const [addressApprox, setAddressApprox] = useState(false);
  const [gpsExplicit, setGpsExplicit] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [fallbackQuery, setFallbackQuery] = useState("");
  const [fallbackSearching, setFallbackSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);
  const sessionTokenRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  );


  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setGpsCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
    );
  }, []);

  function simplifyToCityState(addr: string): string {
    const cleaned = addr.replace(/[–—]/g, ",").replace(/\d{5}-?\d{3}/g, "");
    const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return "";
    const last = parts.slice(-2);
    return `${last.join(", ")}, Brasil`;
  }

  async function placesAutocomplete(q: string, limit = 5): Promise<Suggestion[]> {
    if (!GOOGLE_PLACES_KEY) return [];
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
        },
        body: JSON.stringify({
          input: q,
          regionCode: "BR",
          languageCode: "pt-BR",
          sessionToken: sessionTokenRef.current,
        }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const items = Array.isArray(data?.suggestions) ? data.suggestions.slice(0, limit) : [];
      return items
        .map((it: any) => it?.placePrediction)
        .filter((p: any) => p && p.placeId)
        .map((p: any) => ({
          display_name: p.text?.text ?? p.structuredFormat?.mainText?.text ?? "",
          place_id: p.placeId as string,
        }));
    } catch {
      return [];
    }
  }

  async function placeDetails(placeId: string): Promise<Coords | null> {
    if (!GOOGLE_PLACES_KEY || !placeId) return null;
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
          "X-Goog-FieldMask": "location,formattedAddress",
          "Accept-Language": "pt-BR",
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const lat = data?.location?.latitude;
      const lng = data?.location?.longitude;
      if (typeof lat === "number" && typeof lng === "number" && isFinite(lat) && isFinite(lng)) {
        // rotate session token after a billed Details call (Google session lifecycle)
        sessionTokenRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        return { lat, lng };
      }
      return null;
    } catch {
      return null;
    }
  }


  // Debounced suggestion fetch
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    // User is typing — invalidate any previously selected address coords
    setAddressCoords(null);
    setAddressLabel("");
    setAddressApprox(false);
    setGpsExplicit(false);
    const addr = venueAddress.trim();
    if (addr.length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      setNoResults(false);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      const data = await placesAutocomplete(addr, 5);
      if (data.length > 0) {
        setSuggestions(data);
        setShowSuggestions(true);
        setNoResults(false);
        return;
      }
      // Retry with simplified city/state query
      const simplified = simplifyToCityState(addr);
      if (simplified) {
        const retry = await placesAutocomplete(simplified, 1);
        if (retry.length > 0) {
          const c = await placeDetails(retry[0].place_id);
          if (c) {
            setAddressCoords(c);
            setAddressLabel(simplified.replace(/, Brasil$/, ""));
            setAddressApprox(true);
            setSuggestions([]);
            setShowSuggestions(false);
            setNoResults(false);
            return;
          }
        }
      }
      setSuggestions([]);
      setShowSuggestions(false);
      setNoResults(true);
      setFallbackQuery(simplified.replace(/, Brasil$/, ""));
    }, 800);

    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [venueAddress]);

  async function selectSuggestion(s: Suggestion) {
    justSelectedRef.current = true;
    setVenueAddress(s.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    setNoResults(false);
    setAddressApprox(false);
    setGpsExplicit(false);
    const found = await placeDetails(s.place_id);
    if (!found) return;
    setAddressCoords(found);
    setAddressLabel(s.display_name);
  }

  async function runFallbackSearch() {
    const q = fallbackQuery.trim();
    if (!q) return;
    setFallbackSearching(true);
    const data = await placesAutocomplete(q, 1);
    let c: Coords | null = null;
    if (data.length > 0) c = await placeDetails(data[0].place_id);
    setFallbackSearching(false);
    if (c) {
      setAddressCoords(c);
      setAddressLabel(q);
      setAddressApprox(true);
      setNoResults(false);
      setGpsExplicit(false);
      return;
    }
    toast.error("Ainda não encontramos. Tente só a cidade e estado.");
  }


  function useGpsAsLocation() {
    if (!gpsCoords) {
      toast.error("GPS indisponível. Ative a localização do dispositivo.");
      return;
    }
    setGpsExplicit(true);
    setNoResults(false);
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

  const effectiveCoords: Coords | null = addressCoords ?? (gpsExplicit ? gpsCoords : gpsCoords);
  const effectiveSource: "address" | "gps" = addressCoords ? "address" : "gps";

  async function geocodeOnce(addr: string): Promise<Coords | null> {
    const data = await placesAutocomplete(addr, 1);
    if (data.length > 0) {
      const c = await placeDetails(data[0].place_id);
      if (c) return c;
    }
    const simplified = simplifyToCityState(addr);
    if (simplified) {
      const retry = await placesAutocomplete(simplified, 1);
      if (retry.length > 0) {
        const c = await placeDetails(retry[0].place_id);
        if (c) {
          setAddressLabel(simplified.replace(/, Brasil$/, ""));
          setAddressApprox(true);
          return c;

        }
      }
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    let coords: Coords | null = addressCoords;
    // If user typed an address but didn't pick a suggestion, try to geocode it once.
    if (!coords && venueAddress.trim().length >= 4) {
      coords = await geocodeOnce(venueAddress.trim());
      if (!coords && gpsCoords) {
        toast("Usando sua localização atual como local do jogo.");
      }
    }
    if (!coords) coords = gpsCoords;
    if (!coords) {
      toast.error("Precisamos da sua localização pra criar o jogo");
      return;
    }

    if (visibility === "cep") {
      const digits = cep.replace(/\D/g, "");
      if (digits.length !== 8) {
        toast.error("Informe um CEP válido (8 dígitos)");
        return;
      }
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

        {noResults && (
          <div className="-mt-1 grid gap-2 rounded-[10px] border border-[#2A2A2A] bg-[#1E1E1E] p-3">
            <p className="text-xs text-[#FF4444]">Endereço não encontrado. Ajuste a busca abaixo:</p>
            <div className="flex gap-2">
              <input
                value={fallbackQuery}
                onChange={(e) => setFallbackQuery(e.target.value)}
                className="input-brutal flex-1"
                placeholder="Cidade, Estado"
              />
              <button
                type="button"
                onClick={runFallbackSearch}
                disabled={fallbackSearching}
                className="rounded-[10px] bg-pop text-[#111] px-3 py-2 text-xs font-bold uppercase inline-flex items-center gap-1 disabled:opacity-60"
              >
                {fallbackSearching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                Buscar novamente
              </button>
            </div>
            <button
              type="button"
              onClick={useGpsAsLocation}
              className="text-xs text-ink/70 underline underline-offset-2 text-left inline-flex items-center gap-1"
            >
              <AlertTriangle className="size-3.5 text-[#FFD600]" />
              Ou usar minha localização atual (você está em outra cidade?)
            </button>
          </div>
        )}

        {(addressCoords || gpsExplicit || (!noResults && effectiveCoords)) && (
          <div
            className={`inline-flex items-center gap-1.5 w-fit rounded-full px-3 py-1.5 text-xs font-bold uppercase ${
              addressCoords ? "bg-pop text-[#111]" : "bg-[#2A2A2A] text-ink"
            }`}
          >
            {addressCoords ? <MapPin className="size-3.5" /> : <AlertTriangle className="size-3.5 text-[#FFD600]" />}
            {addressCoords
              ? `Localização: ${(addressLabel.split(",")[0] || venueName || "endereço selecionado").trim()}${addressApprox ? " (cidade aproximada)" : " (endereço)"}`
              : effectiveCoords
                ? "Usando GPS — confira se está na cidade certa"
                : "Aguardando GPS…"}
          </div>
        )}


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

        <Field label="Visibilidade">
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: "public", label: "Público" },
              { id: "friends", label: "Só amigos" },
              { id: "cep", label: "Condomínio" },
            ] as const).map((v) => {
              const isActive = visibility === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVisibility(v.id)}
                  className={`rounded-[10px] border py-2.5 text-xs font-bold uppercase tracking-wide ${
                    isActive
                      ? "bg-[#FFD600] text-[#111] border-[#FFD600]"
                      : "bg-[#1E1E1E] border-[#2A2A2A] text-[#888]"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </Field>

        {visibility === "cep" && (
          <Field label="CEP do condomínio (8 dígitos)">
            <input
              inputMode="numeric"
              maxLength={8}
              value={cep}
              onChange={(e) => setCep(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="00000000"
              className="input-brutal"
            />
          </Field>
        )}


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
