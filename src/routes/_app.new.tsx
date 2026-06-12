import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { distanceKm } from "@/lib/geo";
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

function NewGame() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [sportId, setSportId] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [slots, setSlots] = useState(10);
  const [price, setPrice] = useState(0);
  const [urgency, setUrgency] = useState<"relaxado" | "normal" | "urgente">("normal");
  const [description, setDescription] = useState("");
  const [gpsCoords, setGpsCoords] = useState<Coords | null>(null);
  const [addressCoords, setAddressCoords] = useState<Coords | null>(null);
  const [source, setSource] = useState<"gps" | "address">("gps");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAddrCoords, setPendingAddrCoords] = useState<Coords | null>(null);
  const [saving, setSaving] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setGpsCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
    );
  }, []);

  // Debounced geocoding of typed address
  useEffect(() => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    const addr = venueAddress.trim();
    if (addr.length < 5) {
      setAddressCoords(null);
      setSource("gps");
      return;
    }
    geocodeTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr)}`,
          { headers: { "Accept-Language": "pt-BR" } },
        );
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          setAddressCoords(null);
          setSource("gps");
          return;
        }
        const found: Coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
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
      } catch {
        setAddressCoords(null);
      }
    }, 800);
    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, [venueAddress, gpsCoords]);

  const { data: sports } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id,name,emoji").order("name");
      return data ?? [];
    },
  });

  const effectiveCoords: Coords | null =
    source === "address" && addressCoords ? addressCoords : gpsCoords;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !effectiveCoords) {
      toast.error("Precisamos da sua localização pra criar o jogo");
      return;
    }
    setSaving(true);
    try {
      const { data: venue, error: vErr } = await supabase
        .from("venues")
        .insert({
          created_by: user.id,
          name: venueName,
          address: venueAddress || null,
          latitude: effectiveCoords.lat,
          longitude: effectiveCoords.lng,
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
          slots_total: slots,
          price_cents: Math.round(price * 100),
          urgency,
          latitude: effectiveCoords.lat,
          longitude: effectiveCoords.lng,
        })
        .select("id")
        .single();
      if (gErr) throw gErr;

      toast.success("Jogo criado!");
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
          <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className="input-brutal" placeholder="Rua, número, bairro" />
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
            <input required type="number" min={1} max={50} value={slots} onChange={(e) => setSlots(+e.target.value)} className="input-brutal" />
          </Field>
          <Field label="Valor (R$)">
            <input type="number" min={0} step="0.5" value={price} onChange={(e) => setPrice(+e.target.value)} className="input-brutal" />
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
