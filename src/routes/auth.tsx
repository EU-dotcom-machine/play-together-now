import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { trackEvent } from "@/lib/posthog";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Esportes Unidos" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!user) return;
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("eu_redirect") : null;
    if (stored) sessionStorage.removeItem("eu_redirect");
    const target = stored ?? redirect ?? "/discover";
    navigate({ to: target, replace: true });
  }, [user, redirect, navigate]);

  if (authLoading) return null;
  if (user) return <Navigate to={(redirect ?? "/discover") as string} replace />;

  function isNetworkError(err: any) {
    const msg = String(err?.message ?? err ?? "").toLowerCase();
    return (
      err instanceof TypeError ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("load failed")
    );
  }

  function isEmailNotConfirmed(err: any) {
    return String(err?.message ?? "").toLowerCase().includes("email not confirmed");
  }

  async function resendVerification() {
    if (!verificationEmail) return;
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: verificationEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast.success("E-mail reenviado! Verifique sua caixa de entrada.");
    } catch (err: any) {
      if (isNetworkError(err)) {
        toast.error("Erro de conexão. Verifique sua internet e tente novamente.");
      } else {
        toast.error(err?.message ?? "Erro ao reenviar e-mail");
      }
    } finally {
      setResendLoading(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth/reset",
      });
      if (error) throw error;
      setForgotSent(email);
    } catch (err: any) {
      if (isNetworkError(err)) {
        toast.error("Erro de conexão. Verifique sua internet e tente novamente.");
      } else {
        toast.error(err?.message ?? "Erro ao enviar e-mail");
      }
    } finally {
      setForgotLoading(false);
    }
  }

  function backToSignin() {
    setForgotMode(false);
    setForgotSent(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNetworkError(false);
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
        trackEvent("user_signed_up");
        setVerificationEmail(email);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/discover" });
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        setNetworkError(true);
        toast.error("Erro de conexão. Verifique sua internet e tente novamente.");
      } else if (isEmailNotConfirmed(err)) {
        setVerificationEmail(email);
      } else {
        toast.error(err?.message ?? "Algo deu errado");
      }
    } finally {
      setLoading(false);
    }
  }

  function retry() {
    setNetworkError(false);
    const form = document.getElementById("auth-form") as HTMLFormElement | null;
    form?.requestSubmit();
  }

  return (
    <main className="min-h-screen bg-paper px-5 py-10 flex flex-col">
      <div className="max-w-md w-full mx-auto">
        <h1 className="text-5xl font-extrabold uppercase leading-none">
          {forgotMode ? "Redefinir senha" : mode === "signup" ? "Criar conta" : "Entrar"}
          <span className="text-pop">.</span>
        </h1>
        {!forgotMode && (
          <p className="mt-2 text-ink/70">
            {mode === "signup" ? "Bora pro próximo jogo." : "Já é da pelada?"}
          </p>
        )}

        {verificationEmail ? (
          <div className="mt-8 brutal-card-lg p-6 bg-paper text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-zap/20 text-pop">
              <Mail className="size-7" />
            </div>
            <h2 className="text-2xl font-extrabold uppercase">Verifique seu e-mail ✉️</h2>
            <p className="mt-3 text-ink/80">
              Enviamos um link de confirmação para{" "}
              <span className="font-semibold text-ink">{verificationEmail}</span>. Verifique sua
              caixa de entrada antes de entrar.
            </p>
            <button
              type="button"
              onClick={resendVerification}
              disabled={resendLoading}
              className="brutal-card mt-5 w-full px-5 py-3 bg-pop text-[#111] font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {resendLoading && <Loader2 className="size-4 animate-spin" />}
              Reenviar e-mail
            </button>
          </div>
        ) : forgotMode ? (
          forgotSent ? (
            <div className="mt-8 brutal-card-lg p-6 bg-paper text-center">
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-zap/20 text-pop">
                <Mail className="size-7" />
              </div>
              <h2 className="text-2xl font-extrabold uppercase">Verifique seu e-mail ✉️</h2>
              <p className="mt-3 text-ink/80">
                Enviamos um link para{" "}
                <span className="font-semibold text-ink">{forgotSent}</span>. Clique nele para
                criar uma nova senha.
              </p>
              <button
                type="button"
                onClick={backToSignin}
                className="mt-6 text-sm font-semibold underline underline-offset-4 decoration-2"
              >
                Voltar ao login
              </button>
            </div>
          ) : (
            <form onSubmit={submitForgot} className="mt-8 grid gap-3">
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
              <button
                type="submit"
                disabled={forgotLoading}
                className="brutal-card-lg mt-2 px-5 py-4 bg-pop text-[#111] font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {forgotLoading && <Loader2 className="size-4 animate-spin" />}
                Enviar link de redefinição
              </button>
              <button
                type="button"
                onClick={backToSignin}
                className="mt-4 text-sm font-semibold underline underline-offset-4 decoration-2 justify-self-start"
              >
                Voltar ao login
              </button>
            </form>
          )
        ) : (
          <form id="auth-form" onSubmit={submit} className="mt-8 grid gap-3">
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

            {mode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-ink/70 mt-2">
                <input
                  type="checkbox"
                  required
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 accent-[#FFD600]"
                />
                <span>
                  Li e aceito os{" "}
                  <Link to="/terms" className="underline text-pop">
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacy" className="underline text-pop">
                    Política de Privacidade
                  </Link>
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading || (mode === "signup" && !accepted)}
              className="brutal-card-lg mt-2 px-5 py-4 bg-pop text-[#111] font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "signup" ? "Criar conta" : "Entrar"}
            </button>
            {mode === "signin" && (
              <p className="mt-3 text-xs text-ink/60 text-center">
                <a href="/terms" target="_blank" className="underline">Termos de Uso</a>
                {" · "}
                <a href="/privacy" target="_blank" className="underline">Política de Privacidade</a>
              </p>
            )}
          </form>
        )}
        {mode === "signin" && (
          <Link
            to="/auth/reset"
            className="mt-3 text-xs text-ink/60 underline underline-offset-4 block text-center"
          >
            Esqueci minha senha
          </Link>
        )}

        {networkError && !verificationEmail && (
          <button
            type="button"
            onClick={retry}
            className="brutal-card mt-4 w-full px-5 py-3 bg-paper font-bold uppercase tracking-wide text-sm"
          >
            Tentar novamente
          </button>
        )}

        {!forgotMode && (
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-6 text-sm font-semibold underline underline-offset-4 decoration-2"
          >
            {mode === "signin" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
          </button>
        )}
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
