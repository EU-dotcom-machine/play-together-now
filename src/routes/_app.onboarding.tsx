import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/onboarding")({
  head: () => ({ meta: [{ title: "Bem-vindo — Esportes Unidos" }, { name: "robots", content: "noindex" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: sports } = useQuery({
    queryKey: ["sports-onboarding"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id,name,emoji").order("name");
      return data ?? [];
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveSportsAndContinue() {
    if (!user || selected.size === 0) return;
    setSaving(true);
    try {
      const rows = Array.from(selected).map((sport_id) => ({ user_id: user.id, sport_id }));
      const { error } = await supabase
        .from("user_sport_preferences")
        .upsert(rows, { onConflict: "user_id,sport_id" });
      if (error) throw error;
      setStep(3);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar preferências");
    } finally {
      setSaving(false);
    }
  }

  async function finish(askLocation: boolean) {
    if (!user) return;
    setSaving(true);
    try {
      if (askLocation) {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(),
              (err) => {
                if (err?.code === err?.PERMISSION_DENIED) {
                  toast.info("Tudo bem, você pode ativar depois nas configurações.");
                } else {
                  toast.info("Não conseguimos sua localização agora, seguindo mesmo assim.");
                }
                resolve();
              },
              { maximumAge: 0, timeout: 8000 },
            );
          });
        } else {
          toast.info("Geolocalização indisponível neste dispositivo.");
        }
      }
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
      if (error) throw error;
      queryClient.setQueryData(["onboarding-completed", user.id], true);
      navigate({ to: "/discover", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao concluir onboarding");
      setSaving(false);
    }
  }

  return (
    <main className="fixed inset-0 z-50 bg-paper overflow-y-auto px-5 py-10 flex flex-col">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
            <div className="text-8xl" aria-hidden>🤾</div>
            <h1 className="text-4xl font-extrabold uppercase leading-none">
              Bem-vindo ao Esportes Unidos<span className="text-pop">!</span>
            </h1>
            <p className="text-ink/70 text-lg">
              Conecte-se com quem quer jogar perto de você.
            </p>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="brutal-card-lg mt-4 w-full px-5 py-4 bg-pop text-[#111] font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Vamos lá →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col gap-6">
            <div>
              <h1 className="text-3xl font-extrabold uppercase leading-tight">
                Quais esportes você pratica?
              </h1>
              <p className="mt-2 text-ink/70">
                Você vai ver jogos desses esportes primeiro.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sports?.map((s: any) => {
                const active = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={cn(
                      "brutal-card px-4 py-2 text-sm font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                      active ? "bg-pop text-[#111]" : "bg-paper",
                    )}
                  >
                    <span className="mr-1">{s.emoji ?? "🏅"}</span>
                    {s.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto pt-4">
              <button
                type="button"
                disabled={selected.size === 0 || saving}
                onClick={saveSportsAndContinue}
                className="brutal-card-lg w-full px-5 py-4 bg-pop text-[#111] font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Continuar →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
            <div className="grid size-20 place-items-center rounded-full bg-zap/20 text-pop">
              <MapPin className="size-10" />
            </div>
            <h1 className="text-3xl font-extrabold uppercase leading-tight">
              Ative sua localização
            </h1>
            <p className="text-ink/70">Para encontrar jogos perto de você.</p>
            <div className="w-full grid gap-3 mt-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => finish(true)}
                className="brutal-card-lg w-full px-5 py-4 bg-pop text-[#111] font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Ativar agora
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => finish(false)}
                className="brutal-card w-full px-5 py-3 bg-paper font-bold uppercase tracking-wide disabled:opacity-60"
              >
                Agora não
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
