import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Esportes Unidos" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function getPasswordErrors(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push("8 caracteres");
  if (!/[A-Z]/.test(password)) errors.push("letra maiúscula");
  if (!/\d/.test(password)) errors.push("número");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("caractere especial");
  return errors;
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Supabase puts errors in the URL hash on invalid/expired recovery links,
    // e.g. #error=access_denied&error_code=otp_expired&error_description=...
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("error=") || hash.includes("error_code=")) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const code = params.get("error_code") || params.get("error");
      const desc = params.get("error_description")?.replace(/\+/g, " ");
      setLinkError(desc || code || "Link inválido");
      return;
    }

    // Fallback timeout: if no session appears after 5s, treat the link as invalid.
    const timeout = window.setTimeout(() => {
      if (mounted) {
        setSessionReady((ready) => {
          if (!ready) setLinkError("Link de redefinição inválido ou expirado.");
          return ready;
        });
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionReady(true);
        setLinkError(null);
        window.clearTimeout(timeout);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) {
        setSessionReady(true);
        window.clearTimeout(timeout);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = getPasswordErrors(password);
    if (missing.length > 0) {
      toast.error(`A senha precisa ter: ${missing.join(", ")}.`);
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      navigate({ to: "/discover", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar a senha");
    } finally {
      setLoading(false);
    }
  }

  if (linkError) {
    return (
      <main className="min-h-screen bg-paper px-5 py-10 flex flex-col">
        <div className="max-w-md w-full mx-auto">
          <h1 className="text-5xl font-extrabold uppercase leading-none">
            Link inválido<span className="text-pop">.</span>
          </h1>
          <div className="mt-8 brutal-card-lg p-6 bg-paper">
            <p className="font-bold uppercase tracking-wide text-lg">
              Link de redefinição inválido ou expirado
            </p>
            <p className="mt-2 text-sm text-ink/70 break-words">{linkError}</p>
            <p className="mt-4 text-sm text-ink/80">
              Solicite um novo link para redefinir sua senha.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/auth", replace: true })}
              className="brutal-card mt-5 w-full px-5 py-3 bg-pop text-[#111] font-bold uppercase tracking-wide"
            >
              Voltar ao login
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-5 py-10 flex flex-col">
      <div className="max-w-md w-full mx-auto">
        <h1 className="text-5xl font-extrabold uppercase leading-none">
          Nova senha<span className="text-pop">.</span>
        </h1>
        <p className="mt-2 text-ink/70">
          {sessionReady
            ? "Crie uma senha forte para sua conta."
            : "Validando link de redefinição..."}
        </p>

        <form onSubmit={submit} className="mt-8 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Nova senha</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full brutal-card px-4 py-3 bg-paper outline-none focus:bg-zap/20 pr-11"
                placeholder="••••••••"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/60 hover:text-ink"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            <p className="text-xs text-ink/60 leading-relaxed">
              Pelo menos 8 caracteres, incluindo maiúscula, número e caractere especial
            </p>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Confirmar nova senha</span>
            <input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full brutal-card px-4 py-3 bg-paper outline-none focus:bg-zap/20"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading || !sessionReady}
            className="brutal-card-lg mt-2 px-5 py-4 bg-pop text-[#111] font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Atualizar senha
          </button>
        </form>
      </div>
    </main>
  );
}

