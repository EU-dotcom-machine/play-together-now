import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Check, Clock, UserMinus } from "lucide-react";

type Status = "none" | "pending_out" | "pending_in" | "accepted" | "self";

export function useFriendStatus(targetId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["friend-status", user?.id, targetId],
    enabled: !!user && !!targetId,
    queryFn: async (): Promise<{ status: Status; row: any | null }> => {
      if (user!.id === targetId) return { status: "self", row: null };
      const { data } = await supabase
        .from("friendships" as any)
        .select("*")
        .or(
          `and(requester_id.eq.${user!.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${user!.id})`,
        )
        .maybeSingle();
      if (!data) return { status: "none", row: null };
      const row = data as any;
      if (row.status === "accepted") return { status: "accepted", row };
      if (row.requester_id === user!.id) return { status: "pending_out", row };
      return { status: "pending_in", row };
    },
  });
}

export function AddFriendButton({
  targetId,
  size = "sm",
}: {
  targetId: string;
  size?: "sm" | "md";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useFriendStatus(targetId);
  const [busy, setBusy] = useState(false);

  if (!user || !data || data.status === "self") return null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["friend-status", user.id, targetId] });
    qc.invalidateQueries({ queryKey: ["friends", user.id] });
    qc.invalidateQueries({ queryKey: ["friend-requests", user.id] });
  };

  async function send() {
    setBusy(true);
    const { error } = await supabase
      .from("friendships" as any)
      .insert({ requester_id: user!.id, addressee_id: targetId } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido enviado!");
    invalidate();
  }

  async function accept() {
    setBusy(true);
    const { error } = await supabase
      .from("friendships" as any)
      .update({ status: "accepted" } as any)
      .eq("id", (data!.row as any).id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Amizade confirmada!");
    invalidate();
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase
      .from("friendships" as any)
      .delete()
      .eq("id", (data!.row as any).id);
    setBusy(false);
    if (error) return toast.error(error.message);
    invalidate();
  }

  const cls =
    size === "md"
      ? "px-4 py-2 text-sm"
      : "px-3 py-1 text-xs";

  if (data.status === "none") {
    return (
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className={`${cls} rounded-full bg-pop text-[#111] font-bold uppercase inline-flex items-center gap-1.5 disabled:opacity-50`}
      >
        <UserPlus className="size-3.5" /> Adicionar
      </button>
    );
  }
  if (data.status === "pending_out") {
    return (
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className={`${cls} rounded-full bg-[#1E1E1E] border border-pop text-pop font-bold uppercase inline-flex items-center gap-1.5 disabled:opacity-50`}
      >
        <Clock className="size-3.5" /> Pendente
      </button>
    );
  }
  if (data.status === "pending_in") {
    return (
      <button
        type="button"
        onClick={accept}
        disabled={busy}
        className={`${cls} rounded-full bg-pop text-[#111] font-bold uppercase inline-flex items-center gap-1.5 disabled:opacity-50`}
      >
        <Check className="size-3.5" /> Aceitar
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className={`${cls} rounded-full bg-[#1E1E1E] border border-border text-foreground font-bold uppercase inline-flex items-center gap-1.5 disabled:opacity-50`}
    >
      <UserMinus className="size-3.5" /> Amigos
    </button>
  );
}
