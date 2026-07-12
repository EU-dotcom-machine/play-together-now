import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/sports/$slug")({
  head: () => ({ meta: [{ title: "Esporte — Esportes Unidos" }] }),
  component: SportDetail,
});

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={cn(n <= value ? "fill-pop stroke-ink" : "fill-none stroke-ink/30")}
        />
      ))}
    </div>
  );
}

function SportDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: sport, isLoading } = useQuery({
    queryKey: ["sport", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sports")
        .select("id,name,emoji,slug,avg_rating,total_reviews")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Game reviews (public read) for this sport — join via games
  const { data: gameReviews } = useQuery({
    enabled: !!sport?.id,
    queryKey: ["sport-game-reviews", sport?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_reviews")
        .select("id,rating,comment,created_at,reviewer_id,game_id,games!inner(id,title,sport_id)")
        .eq("games.sport_id", sport!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.reviewer_id)));
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles_public")
          .select("id,display_name")
          .in("id", ids);
        names = Object.fromEntries(((profs ?? []) as any[]).map((p: any) => [p.id, p.display_name]));
      }
      return rows.map((r) => ({ ...r, reviewer_name: names[r.reviewer_id] ?? "Atleta" }));
    },
  });

  // Player reviews — RLS limits to those where the current user is reviewer or reviewee.
  const { data: playerReviews } = useQuery({
    enabled: !!sport?.id && !!user?.id,
    queryKey: ["sport-player-reviews", sport?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_reviews")
        .select("id,rating,comment,created_at,reviewer_id,reviewee_id,game_id,tags,games!inner(id,title,sport_id)")
        .eq("games.sport_id", sport!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = Array.from(new Set(rows.flatMap((r) => [r.reviewer_id, r.reviewee_id])));
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles_public")
          .select("id,display_name")
          .in("id", ids);
        names = Object.fromEntries(((profs ?? []) as any[]).map((p: any) => [p.id, p.display_name]));
      }
      return rows.map((r) => ({
        ...r,
        reviewer_name: names[r.reviewer_id] ?? "Atleta",
        reviewee_name: names[r.reviewee_id] ?? "Atleta",
      }));
    },
  });

  if (isLoading || !sport) {
    return (
      <main className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin" />
      </main>
    );
  }

  const avg = sport.avg_rating ? Number(sport.avg_rating).toFixed(1) : null;

  return (
    <main className="px-5 pt-6 pb-24 max-w-md mx-auto">
      <button onClick={() => navigate({ to: "/sports" })} className="brutal-chip bg-paper mb-4">
        <ArrowLeft className="size-3" /> Esportes
      </button>

      <div className="brutal-card-lg p-5 bg-surface">
        <div className="flex items-center gap-3">
          <span className="text-5xl">{sport.emoji}</span>
          <div>
            <h1 className="text-3xl font-extrabold uppercase leading-none">{sport.name}</h1>
            {avg ? (
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold">
                <Star className="size-4 fill-pop stroke-pop" /> {avg} · {sport.total_reviews} avaliações
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink/60">Ainda sem avaliações</p>
            )}
          </div>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-bold uppercase">Avaliações das atividades</h2>
        <ul className="mt-2 grid gap-2">
          {(gameReviews ?? []).length === 0 && (
            <li className="brutal-card p-4 text-center text-ink/60 text-sm bg-paper">
              Nenhuma avaliação ainda.
            </li>
          )}
          {(gameReviews ?? []).map((r: any) => (
            <li key={r.id} className="brutal-card p-3 bg-paper">
              <div className="flex items-center justify-between gap-2">
                <Link
                  to="/games/$id"
                  params={{ id: r.game_id }}
                  className="font-bold text-sm truncate hover:underline"
                >
                  {r.games?.title}
                </Link>
                <Stars value={r.rating} />
              </div>
              <p className="text-xs text-ink/60 mt-0.5">por {r.reviewer_name}</p>
              {r.comment && <p className="text-sm mt-1 text-ink/80">{r.comment}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold uppercase">Avaliações de atletas</h2>
          <span className="text-xs text-ink/50">visíveis a você</span>
        </div>
        <ul className="mt-2 grid gap-2">
          {(playerReviews ?? []).length === 0 && (
            <li className="brutal-card p-4 text-center text-ink/60 text-sm bg-paper">
              Você ainda não tem avaliações de atletas neste esporte.
            </li>
          )}
          {(playerReviews ?? []).map((r: any) => {
            const iAmReviewer = r.reviewer_id === user?.id;
            return (
              <li key={r.id} className="brutal-card p-3 bg-paper">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm truncate">
                    {iAmReviewer ? `Você → ${r.reviewee_name}` : `${r.reviewer_name} → Você`}
                  </p>
                  <Stars value={r.rating} />
                </div>
                <Link
                  to="/games/$id"
                  params={{ id: r.game_id }}
                  className="text-xs text-ink/60 hover:underline"
                >
                  {r.games?.title}
                </Link>
                {r.tags?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.tags.map((t: string) => (
                      <span key={t} className="brutal-chip bg-zap text-[11px] py-0.5 px-2">{t}</span>
                    ))}
                  </div>
                )}
                {r.comment && <p className="text-sm mt-1 text-ink/80">{r.comment}</p>}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
