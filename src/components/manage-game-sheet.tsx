import { useState } from "react";
import { friendlyError } from "@/lib/friendly-error";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Flag, XCircle, Lock, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  gameId: string;
  slotsFilled: number;
};

type Confirm = {
  title: string;
  message: string;
  onConfirm: () => unknown;
} | null;

export function ManageGameSheet({ open, onClose, gameId, slotsFilled }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function close() {
    setConfirm(null);
    onClose();
  }

  async function finishGame() {
    setBusy(true);
    const { error } = await supabase
      .from("games")
      .update({ status: "finished" } as any)
      .eq("id", gameId);
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Atividade encerrada.");
    qc.invalidateQueries({ queryKey: ["games"] });
    close();
    navigate({ to: "/discover" });
  }

  async function cancelGame() {
    setBusy(true);
    const { error: gErr } = await supabase
      .from("games")
      .update({ status: "cancelled" } as any)
      .eq("id", gameId);
    if (gErr) {
      setBusy(false);
      return toast.error(friendlyError(gErr));
    }
    // Limpeza pós-cancelamento: o jogo já foi cancelado com sucesso acima.
    // Se a remoção dos participantes falhar, apenas registra (não reverte o cancelamento).
    const { error: pErr } = await supabase.from("game_participants").delete().eq("game_id", gameId);
    if (pErr) console.warn("[manage-game] falha ao limpar participantes do jogo cancelado:", pErr.message);
    setBusy(false);
    toast.success("Atividade cancelada.");
    qc.invalidateQueries({ queryKey: ["games"] });
    close();
    navigate({ to: "/discover" });
  }

  async function closeSlots() {
    setBusy(true);
    const { error } = await supabase
      .from("games")
      .update({ slots_total: Math.max(slotsFilled, 0), status: "full" } as any)
      .eq("id", gameId);
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Vagas fechadas.");
    qc.invalidateQueries({ queryKey: ["game", gameId] });
    qc.invalidateQueries({ queryKey: ["games"] });
    close();
  }

  const items = [
    {
      icon: Pencil,
      label: "Editar Atividade",
      onClick: () => {
        close();
        navigate({ to: "/games/$id/edit", params: { id: gameId } });
      },
    },
    {
      icon: Flag,
      label: "Encerrar Atividade",
      onClick: () =>
        setConfirm({
          title: "Encerrar esta atividade?",
          message: "Os participantes serão notificados.",
          onConfirm: finishGame,
        }),
    },
    {
      icon: XCircle,
      label: "Cancelar Atividade",
      onClick: () =>
        setConfirm({
          title: "Cancelar esta atividade?",
          message: "Todos os participantes serão removidos.",
          onConfirm: cancelGame,
        }),
    },
    {
      icon: Lock,
      label: "Fechar vaga",
      onClick: () =>
        setConfirm({
          title: "Fechar vagas agora?",
          message: "Novos atletas não poderão entrar.",
          onConfirm: closeSlots,
        }),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={close}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md mx-auto animate-[slideUp_0.25s_ease-out] bg-surface rounded-t-3xl px-4 pt-5 pb-8"
      >
        <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-border" />
        <h3 className="text-base font-bold uppercase tracking-wider mb-3 px-2 text-foreground">
          Gerenciar Atividade
        </h3>
        <ul className="grid gap-1">
          {items.map((it) => (
            <li key={it.label}>
              <button
                onClick={it.onClick}
                disabled={busy}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left disabled:opacity-50 text-foreground"
              >
                <span className="size-9 rounded-full flex items-center justify-center bg-pop/10">
                  <it.icon className="size-4 text-pop" />
                </span>
                <span className="font-semibold">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {confirm && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center px-6 bg-black/70"
            onClick={() => !busy && setConfirm(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5 bg-surface border border-border"
            >
              <h4 className="text-lg font-bold text-foreground">
                {confirm.title}
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {confirm.message}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                  className="py-3 rounded-full font-bold bg-border text-muted-foreground"
                >
                  Cancelar
                </button>
                <button
                  disabled={busy}
                  onClick={() => confirm.onConfirm()}
                  className="py-3 rounded-full font-bold flex items-center justify-center gap-2 bg-pop text-[#111]"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      </div>
    </div>
  );
}
