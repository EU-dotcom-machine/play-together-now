import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/games/$id/edit")({
  head: () => ({ meta: [{ title: "Editar jogo — Esportes Unidos" }] }),
  component: EditGame,
});

function EditGame() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", id],
    queryFn: async () => {
      const { data } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
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

  const [title, setTitle] = useState("");
  const [sportId, setSportId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [slots, setSlots] = useState(10);
  const [price, setPrice] = useState(0);
  const [urgency, setUrgency] = useState<"relaxado" | "normal" | "urgente">("normal");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (game && !hydrated) {
      setTitle(game.title ?? "");
      setSportId(game.sport_id ?? "");
      const d = new Date(game.starts_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      setStartsAt(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
      setSlots(game.slots_total ?? 10);
      setPrice((game.price_cents ?? 0) / 100);
      setUrgency((game.urgency as any) ?? "normal");
      setDescription(game.description ?? "");
      setHydrated(true);
    }
  }, [game, hydrated]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("games")
      .update({
        title,
        sport_id: sportId,
        starts_at: new Date(startsAt).toISOString(),
        slots_total: slots,
        price_cents: Math.round(price * 100),
        urgency,
        description: description || null,
      } as any)
      .eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Jogo atualizado!");
    qc.invalidateQueries({ queryKey: ["game", id] });
    qc.invalidateQueries({ queryKey: ["games"] });
    navigate({ to: "/games/$id", params: { id } });
  }

  if (isLoading || !game) {
    return (
      <main className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin" />
      </main>
    );
  }

  return (
    <main className="px-5 pt-6 max-w-md mx-auto pb-24">
      <button
        onClick={() => navigate({ to: "/games/$id", params: { id } })}
        className="brutal-chip bg-paper mb-4"
      >
        <ArrowLeft className="size-3" /> Voltar
      </button>

      <h1 className="text-4xl font-extrabold uppercase leading-none">
        Editar jogo<span className="text-pop">.</span>
      </h1>

      <form onSubmit={submit} className="mt-6 grid gap-3">
        <Field label="Título">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input-brutal" />
        </Field>

        <Field label="Esporte">
          <select required value={sportId} onChange={(e) => setSportId(e.target.value)} className="input-brutal">
            <option value="">Escolha…</option>
            {sports?.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quando">
          <input
            required
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="input-brutal"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vagas">
            <input
              required
              type="number"
              min={1}
              max={50}
              value={slots}
              onChange={(e) => setSlots(+e.target.value)}
              className="input-brutal"
            />
          </Field>
          <Field label="Valor (R$)">
            <input
              type="number"
              min={0}
              step="0.5"
              value={price}
              onChange={(e) => setPrice(+e.target.value)}
              className="input-brutal"
            />
          </Field>
        </div>

        <Field label="Urgência">
          <div className="grid grid-cols-3 gap-2">
            {(["relaxado", "normal", "urgente"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={`brutal-card py-2 text-xs font-bold uppercase ${urgency === u ? (u === "urgente" ? "bg-urgent text-white" : u === "normal" ? "bg-pop text-[#111]" : "bg-success text-white") : "bg-paper"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Detalhes">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-brutal min-h-24"
          />
        </Field>

        <button
          disabled={saving}
          className="brutal-card-lg mt-2 px-5 py-4 bg-pop text-paper font-bold uppercase flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Salvar alterações
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
