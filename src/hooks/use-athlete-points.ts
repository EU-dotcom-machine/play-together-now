import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Fonte ÚNICA de pontos: o ranking calculado (participação confirmada + host),
// aposentando o contador legado profiles.points (que dessincronizava).
// Retorna um mapa user_id -> pontos (global, todos os tempos).
//
// Observação de escala: hoje busca o top 200. Como o ranking já ordena por
// pontos desc, qualquer usuário fora do top 200 tem pontuação baixa e cai em 0
// no mapa — aceitável no MVP. Se a base crescer, trocar por uma função
// dedicada get_athlete_points_bulk(uuid[]).
export function useAthletePointsMap() {
  return useQuery({
    queryKey: ["athlete-points-map"],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await (supabase as any).rpc("get_athlete_ranking", {
        p_sport: null,
        p_season: null,
        p_scope: "all",
        p_limit: 200,
      });
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as { user_id: string; points: number }[]) {
        map[r.user_id] = r.points;
      }
      return map;
    },
  });
}
