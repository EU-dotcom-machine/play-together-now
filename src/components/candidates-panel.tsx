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
  sportId: string | null;
};

function formatKm(km: number) {
  return km.toFixed(1).replace(".", ",") + " km de distância";
}

type SportRating = {
  sport_avg: number;
  sport_total: number;
  top_tags: string[];
  overall_avg: number;
  overall_total: number;
};

export function CandidatesPanel({ gameId, gameLat, gameLng, slotsTotal, gameStatus, sportId }: Props) {

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
      const { data: profsRaw } = await (supabase as any)
        .from("profiles_public")
        .select("id,display_name,bio,avatar_url,points,sport_ids,avg_rating,total_reviews")
        .in("id", ids);
      const profs = (profsRaw ?? []) as any[];
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

  const candidateIds = candidates.map((c) => c.user_id);
  const { data: ratingsMap = {} } = useQuery({
    enabled: !!sportId && candidateIds.length > 0,
    queryKey: ["candidate-sport-ratings", gameId, sportId, candidateIds.join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        candidateIds.map(async (uid) => {
          const { data, error } = await (supabase as any).rpc("get_player_sport_rating", {
            player_id: uid,
            sport_id: sportId,
          });
          if (error) return [uid, null] as const;
          const row = Array.isArray(data) ? data[0] : data;
          return [uid, (row ?? null) as SportRating | null] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, SportRating | null>;
    },
  });

  const { data: gameSport } = useQuery({
    enabled: !!sportId,
    queryKey: ["sport", sportId],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id,name,emoji").eq("id", sportId!).maybeSingle();
      return data;
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
        <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">
          Candidatos
        </h2>
        <button
          className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border border-border bg-surface text-foreground"
          onClick={() => setManageOpen(true)}
        >
          <Settings2 className="size-3" /> Gerenciar Jogo
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
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
            const rating = (ratingsMap as Record<string, SportRating | null>)[c.user_id] ?? null;
            const sportTotal = Number(rating?.sport_total ?? 0);
            const overallTotal = Number(rating?.overall_total ?? 0);
            const topTags = (rating?.top_tags ?? []).slice(0, 3);
            return (

              <li
                key={c.user_id}
                className="rounded-xl p-3 border border-border bg-surface border-l-[3px] border-l-pop"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-full flex items-center justify-center font-extrabold text-base shrink-0 bg-pop text-[#111]">
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="size-10 rounded-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold truncate text-foreground">
                        {p?.display_name ?? "Jogador"}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 bg-pop text-[#111]">
                        <Zap className="size-3" /> {p?.points ?? 0} pts
                      </span>
                      {p?.total_reviews > 0 && sportTotal === 0 && (
                        <span className="text-[11px] font-bold text-[#FFB400]">
                          ⭐ {Number(p?.avg_rating ?? 0).toFixed(1)} · {p.total_reviews} {p.total_reviews === 1 ? "avaliação" : "avaliações"}
                        </span>
                      )}
                    </div>
                    {sportTotal > 0 && (
                      <p className="text-xs mt-1 font-bold text-foreground">
                        {gameSport?.emoji ?? "🎯"} {gameSport?.name ?? "Esporte"}:{" "}
                        <span className="text-[#FFB400]">⭐ {Number(rating?.sport_avg ?? 0).toFixed(1)}</span>{" "}
                        <span className="text-muted-foreground font-normal">· {sportTotal} {sportTotal === 1 ? "jogo" : "jogos"}</span>
                      </p>
                    )}
                    {overallTotal > 0 && (
                      <p className="text-[11px] mt-0.5 text-muted-foreground">
                        Geral: ⭐ {Number(rating?.overall_avg ?? 0).toFixed(1)} · {overallTotal} {overallTotal === 1 ? "jogo" : "jogos"}
                      </p>
                    )}
                    {topTags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {topTags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pop/15 text-foreground border border-pop/30"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {km != null ? (
                      <p className="text-xs mt-1 flex items-center gap-1 text-muted-foreground">
                        <MapPin className="size-3" /> {formatKm(km)}
                      </p>
                    ) : (
                      <p className="text-xs mt-1 text-muted-foreground">
                        Localização não informada
                      </p>
                    )}
                    {c.sports.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.sports.map((s: any) => (
                          <span
                            key={s.id}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-border bg-surface text-muted-foreground"
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
                    className="flex-1 px-4 py-2.5 rounded-full font-extrabold text-sm uppercase flex items-center justify-center gap-1 disabled:opacity-50 bg-pop text-[#111]"
                  >
                    <Check className="size-4" /> Confirmar
                  </button>
                  <button
                    disabled={busy === c.user_id}
                    onClick={() => decide(c.user_id, "declined")}
                    className="flex-1 px-4 py-2.5 rounded-full font-bold text-sm uppercase flex items-center justify-center gap-1 disabled:opacity-50 bg-border text-muted-foreground"
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
