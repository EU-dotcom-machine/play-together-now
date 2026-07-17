import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "atletas" | "espacos";
type Season = "temporada" | "todos";
type Scope = "todos" | "amigos";

type AthleteRow = { user_id: string; display_name: string | null; avatar_url: string | null; points: number };
type VenueRow = { venue_id: string; name: string | null; address: string | null; points: number };

// Primeiro dia do mês corrente no formato aceito pelo Postgres (date).
function currentSeason(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full bg-surface border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors",
            value === o.value ? "bg-pop text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function rankAccent(i: number): string {
  if (i === 0) return "text-pop";
  if (i === 1) return "text-ink/80";
  if (i === 2) return "text-[#CD7F32]";
  return "text-muted-foreground";
}

export function RankingSection() {
  const [mode, setMode] = useState<Mode>("atletas");
  const [sportId, setSportId] = useState<string | null>(null);
  const [season, setSeason] = useState<Season>("temporada");
  const [scope, setScope] = useState<Scope>("todos");

  const { data: sports } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id,name,emoji").order("name");
      return data ?? [];
    },
  });

  const seasonParam = season === "temporada" ? currentSeason() : null;

  const { data: athletes, isLoading: loadingA } = useQuery({
    queryKey: ["ranking-athletes", sportId, seasonParam, scope],
    enabled: mode === "atletas",
    queryFn: async (): Promise<AthleteRow[]> => {
      const { data, error } = await (supabase as any).rpc("get_athlete_ranking", {
        p_sport: sportId,
        p_season: seasonParam,
        p_scope: scope === "amigos" ? "friends" : "all",
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as AthleteRow[];
    },
  });

  const { data: venues, isLoading: loadingV } = useQuery({
    queryKey: ["ranking-venues", sportId, seasonParam],
    enabled: mode === "espacos",
    queryFn: async (): Promise<VenueRow[]> => {
      const { data, error } = await (supabase as any).rpc("get_venue_ranking", {
        p_sport: sportId,
        p_season: seasonParam,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as VenueRow[];
    },
  });

  const loading = mode === "atletas" ? loadingA : loadingV;
  const rows = mode === "atletas" ? athletes ?? [] : venues ?? [];

  const sportChips = useMemo(
    () => [{ id: null as string | null, name: "Todos", emoji: "🏆" }, ...(sports ?? [])],
    [sports],
  );

  return (
    <section className="mt-6">
      {/* Atletas | Espaços */}
      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: "atletas", label: "Atletas" },
          { value: "espacos", label: "Espaços" },
        ]}
      />

      {/* Chips de esporte */}
      <div
        className="mt-3 -mx-5 px-5 flex gap-2 overflow-x-auto pb-1 chips-filter"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {sportChips.map((s) => (
          <button
            key={s.id ?? "all"}
            type="button"
            onClick={() => setSportId(s.id)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-colors",
              sportId === s.id
                ? "bg-pop text-primary-foreground border-pop"
                : "bg-surface text-ink border-border",
            )}
          >
            {s.emoji} {s.name}
          </button>
        ))}
      </div>

      {/* Janela + escopo */}
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <Segmented<Season>
          value={season}
          onChange={setSeason}
          options={[
            { value: "temporada", label: "Temporada" },
            { value: "todos", label: "Todos os tempos" },
          ]}
        />
        {mode === "atletas" && (
          <Segmented<Scope>
            value={scope}
            onChange={setScope}
            options={[
              { value: "todos", label: "Todos" },
              { value: "amigos", label: "Amigos" },
            ]}
          />
        )}
      </div>

      {/* Lista */}
      <div className="mt-4 grid gap-2">
        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="brutal-card p-4 text-center text-sm text-muted-foreground">
            {mode === "atletas"
              ? "Ninguém pontuou ainda nesse recorte. Bora jogar!"
              : "Nenhum espaço pontuou ainda nesse recorte."}
          </p>
        ) : (
          rows.map((row, i) => {
            const isAthlete = mode === "atletas";
            const name = isAthlete
              ? (row as AthleteRow).display_name ?? "Atleta"
              : (row as VenueRow).name ?? "Espaço";
            const sub = isAthlete ? null : (row as VenueRow).address;
            const avatar = isAthlete ? (row as AthleteRow).avatar_url : null;
            return (
              <div key={i} className="brutal-card p-3 flex items-center gap-3">
                <span className={cn("w-6 text-center font-extrabold text-lg tabular-nums", rankAccent(i))}>
                  {i + 1}
                </span>
                {isAthlete ? (
                  avatar ? (
                    <img src={avatar} alt="" className="size-9 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="size-9 rounded-full bg-pop text-primary-foreground flex items-center justify-center text-sm font-extrabold shrink-0">
                      {name[0]?.toUpperCase() ?? "?"}
                    </div>
                  )
                ) : (
                  <div className="size-9 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                    <MapPin className="size-4 text-pop" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-ink truncate">{name}</p>
                  {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
                </div>
                <span className="inline-flex items-center gap-1 text-pop font-extrabold text-sm shrink-0">
                  <Trophy className="size-3.5" /> {row.points}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
