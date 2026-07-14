import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

export const Route = createFileRoute("/auth_/reset")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Esportes Unidos" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestResetPage,
});

function RequestResetPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://esportesunidoseu.com.br/reset-password",
      });
      if (error) throw error;
      setSent(email);
      toast.success("Email enviado! Verifique sua caixa de entrada e o spam.");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar e-mail");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper px-5 py-10 flex flex-col">
      <div className="max-w-md w-full mx-auto">
        <h1 className="text-5xl font-extrabold uppercase leading-none">
          Redefinir senha<span className="text-pop">.</span>
        </h1>
        <p className="mt-2 text-ink/70">
          Informe seu e-mail para receber o link de recuperação.
        </p>

        {sent ? (
          <div className="mt-8 brutal-card-lg p-6 bg-paper text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-zap/20 text-pop">
              <Mail className="size-7" />
            </div>
            <h2 className="text-2xl font-extrabold uppercase">Email enviado ✉️</h2>
            <p className="mt-3 text-ink/80">
              Enviamos um link para{" "}
              <span className="font-semibold text-ink">{sent}</span>. Verifique sua caixa de
              entrada e o spam.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-block text-sm font-semibold underline underline-offset-4 decoration-2"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full brutal-card px-4 py-3 bg-paper outline-none focus:bg-zap/20"
                placeholder="voce@exemplo.com"
                required
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="brutal-card-lg mt-2 px-5 py-4 bg-pop text-[#111] font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Enviar link
            </button>
            <Link
              to="/auth"
              className="mt-4 text-sm font-semibold underline underline-offset-4 decoration-2 justify-self-start"
            >
              Voltar para o login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
