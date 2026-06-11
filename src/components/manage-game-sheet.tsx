import { useState } from "react";
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
    if (error) return toast.error(error.message);
    toast.success("Jogo encerrado.");
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
      return toast.error(gErr.message);
    }
    await supabase.from("game_participants").delete().eq("game_id", gameId);
    setBusy(false);
    toast.success("Jogo cancelado.");
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
    if (error) return toast.error(error.message);
    toast.success("Vagas fechadas.");
    qc.invalidateQueries({ queryKey: ["game", gameId] });
    qc.invalidateQueries({ queryKey: ["games"] });
    close();
  }

  const items = [
    {
      icon: Pencil,
      label: "Editar Jogo",
      onClick: () => {
        close();
        navigate({ to: "/games/$id/edit", params: { id: gameId } });
      },
    },
    {
      icon: Flag,
      label: "Encerrar Jogo",
      onClick: () =>
        setConfirm({
          title: "Encerrar este jogo?",
          message: "Os participantes serão notificados.",
          onConfirm: finishGame,
        }),
    },
    {
      icon: XCircle,
      label: "Cancelar Jogo",
      onClick: () =>
        setConfirm({
          title: "Cancelar este jogo?",
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
          message: "Novos jogadores não poderão entrar.",
          onConfirm: closeSlots,
        }),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={close}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md mx-auto animate-[slideUp_0.25s_ease-out]"
        style={{
          background: "#1E1E1E",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: "20px 16px 32px",
        }}
      >
        <div
          className="mx-auto mb-4 rounded-full"
          style={{ width: 44, height: 4, background: "#2A2A2A" }}
        />
        <h3
          className="text-base font-bold uppercase tracking-wider mb-3 px-2"
          style={{ color: "#fff" }}
        >
          Gerenciar Jogo
        </h3>
        <ul className="grid gap-1">
          {items.map((it) => (
            <li key={it.label}>
              <button
                onClick={it.onClick}
                disabled={busy}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left disabled:opacity-50"
                style={{ background: "transparent", color: "#fff" }}
              >
                <span
                  className="size-9 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,214,0,0.12)" }}
                >
                  <it.icon className="size-4" style={{ color: "#FFD600" }} />
                </span>
                <span className="font-semibold">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {confirm && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => !busy && setConfirm(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5"
              style={{ background: "#1E1E1E", border: "1px solid #2A2A2A" }}
            >
              <h4 className="text-lg font-bold" style={{ color: "#fff" }}>
                {confirm.title}
              </h4>
              <p className="mt-1 text-sm" style={{ color: "#888" }}>
                {confirm.message}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                  className="py-3 rounded-full font-bold"
                  style={{ background: "#2A2A2A", color: "#888" }}
                >
                  Cancelar
                </button>
                <button
                  disabled={busy}
                  onClick={() => confirm.onConfirm()}
                  className="py-3 rounded-full font-bold flex items-center justify-center gap-2"
                  style={{ background: "#FFD600", color: "#111" }}
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
