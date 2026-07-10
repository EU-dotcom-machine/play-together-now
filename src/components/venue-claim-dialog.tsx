import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, BadgeCheck, Clock, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatDateDisplay } from "@/lib/utils";

const claimSchema = z.object({
  contact_name: z.string().trim().min(2, "Informe seu nome").max(100),
  contact_email: z.string().trim().email("E-mail inválido").max(255),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  role_at_venue: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: string;
  venueName: string;
};

type ClaimRow = {
  id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  reviewed_at: string | null;
};

export function VenueClaimDialog({ open, onOpenChange, venueId, venueName }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: existing, isLoading } = useQuery({
    queryKey: ["venue-claim", venueId, user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("venue_claims" as any)
        .select("id,status,created_at,reviewed_at")
        .eq("venue_id", venueId)
        .eq("claimant_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as ClaimRow | null) ?? null;
    },
  });

  const [form, setForm] = useState({
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    role_at_venue: "",
    message: "",
  });

  useEffect(() => {
    if (open && user) {
      setForm((f) => ({
        ...f,
        contact_email: f.contact_email || user.email || "",
      }));
    }
  }, [open, user]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para reivindicar.");
      const parsed = claimSchema.safeParse(form);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      }
      const payload = {
        venue_id: venueId,
        claimant_id: user.id,
        contact_name: parsed.data.contact_name,
        contact_email: parsed.data.contact_email,
        contact_phone: parsed.data.contact_phone || null,
        role_at_venue: parsed.data.role_at_venue || null,
        message: parsed.data.message || null,
      };
      const { error } = await supabase.from("venue_claims" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação enviada! Avaliaremos em breve.");
      qc.invalidateQueries({ queryKey: ["venue-claim", venueId, user?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível enviar."),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!existing) return;
      const { error } = await supabase
        .from("venue_claims" as any)
        .update({ status: "rejected" } as any)
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação cancelada.");
      qc.invalidateQueries({ queryKey: ["venue-claim", venueId, user?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cancelar."),
  });

  const statusBadge = existing ? (
    existing.status === "pending" ? (
      <div className="flex items-center gap-2 text-sm font-bold text-amber-600">
        <Clock className="size-4" /> Pendente — em análise
      </div>
    ) : existing.status === "accepted" ? (
      <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
        <BadgeCheck className="size-4" /> Aceita — você é o responsável
      </div>
    ) : (
      <div className="flex items-center gap-2 text-sm font-bold text-rose-600">
        <XCircle className="size-4" /> Recusada
      </div>
    )
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="overflow-y-auto max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="uppercase">Reivindicar este espaço</DialogTitle>
            <DialogDescription>
              {venueName} — envie seus dados para nossa equipe verificar a titularidade.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : existing && existing.status !== "rejected" ? (
          <div className="space-y-3 py-2">
            {statusBadge}
              <p className="text-sm text-muted-foreground">
                Sua solicitação foi enviada em{" "}
                {formatDateDisplay(existing.created_at, { day: "2-digit", month: "2-digit", year: "numeric" })}.
              </p>
            {existing.status === "pending" && (
              <Button
                variant="outline"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="w-full"
              >
                {cancel.isPending ? <Loader2 className="size-4 animate-spin" /> : "Cancelar solicitação"}
              </Button>
            )}
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            {existing?.status === "rejected" && statusBadge}
            <div>
              <Label htmlFor="vc-name">Seu nome *</Label>
              <Input
                id="vc-name"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                maxLength={100}
                required
              />
            </div>
            <div>
              <Label htmlFor="vc-email">E-mail *</Label>
              <Input
                id="vc-email"
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                maxLength={255}
                required
              />
            </div>
            <div>
              <Label htmlFor="vc-phone">Telefone</Label>
              <Input
                id="vc-phone"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                maxLength={40}
              />
            </div>
            <div>
              <Label htmlFor="vc-role">Sua função no espaço</Label>
              <Input
                id="vc-role"
                placeholder="Ex: Dono, gerente, sócio"
                value={form.role_at_venue}
                onChange={(e) => setForm({ ...form, role_at_venue: e.target.value })}
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="vc-msg">Mensagem</Label>
              <Textarea
                id="vc-msg"
                rows={3}
                placeholder="Conte como podemos validar"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                maxLength={1000}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submit.isPending}>
                {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Enviar solicitação"}
              </Button>
            </DialogFooter>
          </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
