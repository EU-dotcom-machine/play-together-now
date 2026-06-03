import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SPONSOR_BRANDS, brandGradient } from "@/lib/brands";
import { toast } from "sonner";
import { LogOut, Save, Trophy } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Perfil — PEGA" }] }),
  component: Profile,
});

function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      return data;
    },
  });

  const [display, setDisplay] = useState("");
  const [bio, setBio] = useState("");
  const [sponsor, setSponsor] = useState<string | null>(null);

  // sync once profile loads
  if (profile && display === "" && profile.display_name) setDisplay(profile.display_name);
  if (profile && bio === "" && profile.bio) setBio(profile.bio);
  if (profile && sponsor === null) setSponsor(profile.sponsor_brand);

  async function save() {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: display, bio, sponsor_brand: sponsor })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Perfil salvo!");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const gradient = brandGradient(sponsor);

  return (
    <main className="max-w-md mx-auto">
      <header
        className="px-5 pt-10 pb-16 text-paper border-b-2 border-ink"
        style={{ background: gradient }}
      >
        <div className="brutal-card-lg bg-paper text-ink p-4 inline-flex items-center gap-3">
          <div className="size-12 rounded-full bg-pop border-2 border-ink text-paper flex items-center justify-center text-xl font-bold">
            {display?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-xs uppercase font-bold opacity-70">jogador</p>
            <p className="text-xl font-extrabold leading-none">{display || "—"}</p>
          </div>
        </div>

        <div className="mt-4 brutal-chip bg-zap text-ink">
          <Trophy className="size-3" /> {profile?.points ?? 0} pontos
        </div>
      </header>

      <section className="px-5 py-6 grid gap-3">
        <Field label="Nome">
          <input value={display} onChange={(e) => setDisplay(e.target.value)} className="input-brutal" />
        </Field>
        <Field label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input-brutal min-h-20" placeholder="Joga o quê, em que nível…" />
        </Field>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-2">Patrocinador (estilo do perfil)</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSponsor(null)}
              className={`brutal-card p-3 text-sm font-bold uppercase ${sponsor === null ? "bg-zap" : "bg-paper"}`}
            >
              Nenhum
            </button>
            {SPONSOR_BRANDS.map((b) => (
              <button
                key={b.name}
                type="button"
                onClick={() => setSponsor(b.name)}
                className={`brutal-card p-3 text-sm font-bold uppercase text-paper ${sponsor === b.name ? "ring-4 ring-ink" : ""}`}
                style={{ background: b.gradient }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          className="brutal-card-lg mt-3 px-5 py-4 bg-pop text-paper font-bold uppercase flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <Save className="size-4" /> Salvar
        </button>
        <button
          onClick={signOut}
          className="brutal-card px-5 py-3 bg-paper font-bold uppercase flex items-center justify-center gap-2"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </section>
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
