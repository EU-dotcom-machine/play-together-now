import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Zap, MapPin, Settings2 } from "lucide-react";
import { distanceKm } from "@/lib/geo";
import { ManageGameSheet } from "@/components/manage-game-sheet";

type Props = {
  gameId: string;
  gameLat: number | null;
  gameLng: number | null;
  slotsTotal: number;
  gameStatus: string;
};

function formatKm(km: number) {
  return km.toFixed(1).replace(".", ",") + " km de distância";
}

export function CandidatesPanel({ gameId, gameLat, gameLng, slotsTotal, gameStatus }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const { data: confirmedCount = 0 } = useQuery({
    queryKey: ["confirmed-count", gameId],
    queryFn: async () => {
      const { count } = await supabase
        .from("game_participants")
        .select("user_id", { count: "exact", head: true })
        .eq("game_id", gameId)
        .eq("status" as any, "confirmed");
      return count ?? 0;
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates", gameId],
    queryFn: async () => {
      const { data: parts, error } = await supabase
        .from("game_participants")
        .select("user_id,status" as any)
        .eq("game_id", gameId)
        .eq("status" as any, "pending");
      if (error) throw error;
      const rows = (parts ?? []) as any[];
      const ids = rows.map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name,bio,avatar_url,points,latitude,longitude,sport_ids")
        .in("id", ids);
      const allSportIds = Array.from(
        new Set((profs ?? []).flatMap((p: any) => (p.sport_ids as string[] | null) ?? [])),
      );
      const { data: sports } = allSportIds.length
        ? await supabase.from("sports").select("id,name,emoji").in("id", allSportIds)
        : { data: [] as any[] };
      return rows.map((r) => {
        const p: any = profs?.find((x) => x.id === r.user_id);
        return {
          user_id: r.user_id,
          profile: p,
          sports:
            ((p?.sport_ids as string[] | null) ?? [])
              .map((sid) => sports?.find((s) => s.id === sid))
              .filter(Boolean) ?? [],
        };
      });
    },
  });

  async function decide(userId: string, status: "confirmed" | "declined") {
    setBusy(userId);
    const { error } = await supabase
      .from("game_participants")
      .update({ status } as any)
      .eq("game_id", gameId)
      .eq("user_id", userId);
    if (error) {
      setBusy(null);
      return toast.error(error.message);
    }
    if (status === "confirmed") {
      // Check if game is now full and flip to 'full'
      const { count } = await supabase
        .from("game_participants")
        .select("user_id", { count: "exact", head: true })
        .eq("game_id", gameId)
        .eq("status" as any, "confirmed");
      if ((count ?? 0) >= slotsTotal && gameStatus !== "full") {
        await supabase.from("games").update({ status: "full" } as any).eq("id", gameId);
        qc.invalidateQueries({ queryKey: ["game", gameId] });
      }
      toast.success("Jogador confirmado!");
    } else {
      toast("Jogador recusado.");
    }
    qc.invalidateQueries({ queryKey: ["candidates", gameId] });
    qc.invalidateQueries({ queryKey: ["participants", gameId] });
    qc.invalidateQueries({ queryKey: ["games"] });
    setBusy(null);
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold uppercase tracking-wide" style={{ color: "#fff" }}>
          Candidatos
        </h2>
        <button
          className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border"
          style={{ background: "#1E1E1E", color: "#fff", borderColor: "#2A2A2A" }}
          onClick={() => setManageOpen(true)}
        >
          <Settings2 className="size-3" /> Gerenciar Jogo
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "#888" }}>
          Nenhuma solicitação no momento.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {candidates.map((c) => {
            const p = c.profile;
            const initials = (p?.display_name ?? "?").slice(0, 1).toUpperCase();
            const km =
              gameLat != null && gameLng != null && p?.latitude != null && p?.longitude != null
                ? distanceKm(gameLat, gameLng, p.latitude, p.longitude)
                : null;
            return (
              <li
                key={c.user_id}
                className="rounded-xl p-3 border"
                style={{
                  background: "#1E1E1E",
                  borderColor: "#2A2A2A",
                  borderLeftWidth: "3px",
                  borderLeftColor: "#FFD600",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="size-10 rounded-full flex items-center justify-center font-extrabold text-base shrink-0"
                    style={{ background: "#FFD600", color: "#111" }}
                  >
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="size-10 rounded-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold truncate" style={{ color: "#fff" }}>
                        {p?.display_name ?? "Jogador"}
                      </p>
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1"
                        style={{ background: "#FFD600", color: "#111" }}
                      >
                        <Zap className="size-3" /> {p?.points ?? 0} pts
                      </span>
                    </div>
                    {km != null ? (
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#888" }}>
                        <MapPin className="size-3" /> {formatKm(km)}
                      </p>
                    ) : (
                      <p className="text-xs mt-1" style={{ color: "#888" }}>
                        Localização não informada
                      </p>
                    )}
                    {c.sports.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.sports.map((s: any) => (
                          <span
                            key={s.id}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{ background: "#1E1E1E", color: "#888", borderColor: "#2A2A2A" }}
                          >
                            {s.emoji} {s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busy === c.user_id}
                    onClick={() => decide(c.user_id, "confirmed")}
                    className="flex-1 px-4 py-2.5 rounded-full font-extrabold text-sm uppercase flex items-center justify-center gap-1 disabled:opacity-50"
                    style={{ background: "#FFD600", color: "#111" }}
                  >
                    <Check className="size-4" /> Confirmar
                  </button>
                  <button
                    disabled={busy === c.user_id}
                    onClick={() => decide(c.user_id, "declined")}
                    className="flex-1 px-4 py-2.5 rounded-full font-bold text-sm uppercase flex items-center justify-center gap-1 disabled:opacity-50"
                    style={{ background: "#2A2A2A", color: "#888" }}
                  >
                    <X className="size-4" /> Recusar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ManageGameSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        gameId={gameId}
        slotsFilled={confirmedCount}
      />
    </section>
  );
}
