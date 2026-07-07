import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check, Calendar, X as XIcon, UserPlus, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { nearbyAlertsStore } from "@/lib/nearby-alerts-store";

type NotificationRow = {
  id: string;
  user_id: string;
  type:
    | "game_confirmed"
    | "game_declined"
    | "friend_request"
    | "game_nearby"
    | "venue_claim_accepted"
    | "venue_claim_rejected";
  title: string;
  body: string;
  data: { game_id?: string; requester_id?: string; venue_id?: string; claim_id?: string } | null;
  read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function iconFor(type: NotificationRow["type"]) {
  if (type === "game_confirmed") return <Check className="size-5 text-[#FFD600]" />;
  if (type === "game_declined") return <XIcon className="size-5 text-[#FF6B6B]" />;
  if (type === "friend_request") return <UserPlus className="size-5 text-[#FFD600]" />;
  if (type === "venue_claim_accepted") return <Check className="size-5 text-[#FFD600]" />;
  if (type === "venue_claim_rejected") return <XIcon className="size-5 text-[#FF6B6B]" />;
  return <MapPin className="size-5 text-[#FFD600]" />;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const nearbyUnseen = useSyncExternalStore(
    nearbyAlertsStore.subscribe,
    nearbyAlertsStore.getSnapshot,
    nearbyAlertsStore.getServerSnapshot,
  );

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) nearbyAlertsStore.reset();
  }

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data } = await supabase
        .from("notifications" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return ((data ?? []) as unknown) as NotificationRow[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const unread = notifications.filter((n) => !n.read).length;

  async function markRead(n: NotificationRow) {
    if (!n.read) {
      await supabase.from("notifications" as any).update({ read: true }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    }
  }

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from("notifications" as any)
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  }

  async function handleClick(n: NotificationRow) {
    await markRead(n);
    setOpen(false);
    if (n.type === "friend_request") {
      navigate({ to: "/friends" });
    } else if (n.type === "venue_claim_accepted" || n.type === "venue_claim_rejected") {
      navigate({
        to: "/discover",
        search: { tab: "estabelecimentos" as const, venueId: n.data?.venue_id },
      });
    } else if (n.data?.game_id) {
      navigate({ to: "/games/$id", params: { id: n.data.game_id } });
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Notificações"
        onClick={() => handleOpen(true)}
        className="relative brutal-card-lg p-2 bg-paper shrink-0"
      >
        <Bell className="size-5" />
        {(unread > 0 || nearbyUnseen > 0) && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center"
            style={{ backgroundColor: "#FFD600", color: "#111", boxShadow: "0 0 0 2px #111" }}
          >
            {unread + nearbyUnseen}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={handleOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-0 p-0 max-h-[85vh] overflow-y-auto"
          style={{ backgroundColor: "#1E1E1E", color: "white" }}
        >
          <SheetHeader className="px-5 pt-5 pb-3 flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-white text-xl font-extrabold uppercase">
              Notificações
            </SheetTitle>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-bold uppercase text-[#FFD600] underline underline-offset-2"
              >
                Marcar tudo como lido
              </button>
            )}
          </SheetHeader>

          <div className="px-5 pb-8 space-y-2">
            {notifications.length === 0 && (
              <p className="text-center text-white/60 py-12 text-sm">
                Nada por aqui ainda.
              </p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className="w-full text-left rounded-2xl p-3 flex gap-3 items-start transition-colors"
                style={{
                  backgroundColor: n.read ? "#2A2A2A" : "#333",
                  borderLeft: n.read ? "3px solid transparent" : "3px solid #FFD600",
                }}
              >
                <div className="shrink-0 mt-0.5 flex items-center gap-2">
                  {iconFor(n.type)}
                  {!n.read && (
                    <span
                      className="block rounded-full"
                      style={{ width: 8, height: 8, backgroundColor: "#FFD600" }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white">{n.title}</p>
                  <p className="text-xs text-white/70 mt-0.5">{n.body}</p>
                  <p className="text-[10px] uppercase text-white/50 mt-1 inline-flex items-center gap-1">
                    <Calendar className="size-3" />
                    {timeAgo(n.created_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
