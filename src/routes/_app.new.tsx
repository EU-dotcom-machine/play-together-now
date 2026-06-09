import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";

export const Route = createFileRoute("/_app/new")({
  head: () => ({ meta: [{ title: "Criar jogo — PEGA" }] }),
  component: NewGame,
});

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
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
    );
  }, []);

  const { data: sports } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id,name,emoji").order("name");
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !coords) {
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
          slots_total: slots,
          price_cents: Math.round(price * 100),
          urgency,
          latitude: coords.lat,
          longitude: coords.lng,
        })
        .select("id")
        .single();
      if (gErr) throw gErr;
      // Host is the organizer, not a confirmed slot — do not insert into game_participants.

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

        <div className="brutal-chip bg-zap w-fit">
          <MapPin className="size-3" />
          {coords ? "Localização capturada" : "Aguardando GPS…"}
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
            {(["relaxado", "normal", "urgente"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={`brutal-card py-2 text-xs font-bold uppercase ${urgency === u ? (u === "urgente" ? "bg-pop text-paper" : "bg-zap") : "bg-paper"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Detalhes">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-brutal min-h-24" placeholder="Nível, regras, o que levar…" />
        </Field>

        <button
          disabled={saving}
          className="brutal-card-lg mt-2 px-5 py-4 bg-pop text-paper font-bold uppercase flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60"
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
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
