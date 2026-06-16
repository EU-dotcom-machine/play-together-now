import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/reset")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Esportes Unidos" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada!");
      navigate({ to: "/discover" });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar a senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper px-5 py-10 flex flex-col">
      <div className="max-w-md w-full mx-auto">
        <h1 className="text-5xl font-extrabold uppercase leading-none">
          Nova senha<span className="text-pop">.</span>
        </h1>
        <p className="mt-2 text-ink/70">Crie uma senha forte para sua conta.</p>

        <form onSubmit={submit} className="mt-8 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Nova senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full brutal-card px-4 py-3 bg-paper outline-none focus:bg-zap/20"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Confirmar senha</span>
            <input
              type="password"
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
            disabled={loading}
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
