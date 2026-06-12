import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/posthog";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Esportes Unidos" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) return null;
  if (user) return <Navigate to="/discover" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Bora jogar.");
        navigate({ to: "/discover" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/discover" });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Algo deu errado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper px-5 py-10 flex flex-col">
      <div className="max-w-md w-full mx-auto">
        <h1 className="text-5xl font-extrabold uppercase leading-none">
          {mode === "signup" ? "Criar conta" : "Entrar"}
          <span className="text-pop">.</span>
        </h1>
        <p className="mt-2 text-ink/70">
          {mode === "signup" ? "Bora pro próximo jogo." : "Já é da pelada?"}
        </p>

        <form onSubmit={submit} className="mt-8 grid gap-3">
          {mode === "signup" && (
            <Field label="Como te chamam">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full brutal-card px-4 py-3 bg-paper outline-none focus:bg-zap/20"
                placeholder="Ex.: Bruno"
                required
              />
            </Field>
          )}
          <Field label="E-mail">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full brutal-card px-4 py-3 bg-paper outline-none focus:bg-zap/20"
              placeholder="voce@exemplo.com"
              required
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full brutal-card px-4 py-3 bg-paper outline-none focus:bg-zap/20"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="brutal-card-lg mt-2 px-5 py-4 bg-pop text-[#111] font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {mode === "signup" ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-sm font-semibold underline underline-offset-4 decoration-2"
        >
          {mode === "signin" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </button>
      </div>
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
