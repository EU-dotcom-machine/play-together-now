import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const TAG_ROWS = [
  ["Pontual", "Respeitoso", "Animado", "Bem-humorado"],
  ["Habilidoso", "Justo no jogo", "Comunicativo", "Competitivo saudável"],
  ["Trabalho em equipe", "Voltaria a jogar", "Organizado", "Deixou o espaço limpo"],
];

type Coparticipant = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

type PendingGame = {
  game_id: string;
  game_title: string;
  coparticipants: Coparticipant[];
};

type Draft = {
  rating: number;
  tags: Set<string>;
  comment: string;
};

function StickFigure({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 36"
      width="32"
      height="48"
      className={filled ? "text-zap" : "text-ink/20"}
      fill="currentColor"
    >
      <circle cx="10" cy="4" r="3.5" />
      <line x1="10" y1="7.5" x2="10" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="10" y1="12" x2="2" y2="7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="10" y1="12" x2="18" y2="7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="10" y1="22" x2="4" y2="33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="10" y1="22" x2="16" y2="33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PostGameReviewGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<PendingGame[]>([]);
  const [checked, setChecked] = useState(false);

  const check = useCallback(async () => {
    if (!user) return;
    // 1. Confirmed participations of mine with finished games
    const { data: myParts } = await supabase
      .from("game_participants")
      .select("game_id, games!inner(id,title,ends_at,status)")
      .eq("user_id", user.id)
      .eq("status", "confirmed");
    const finished = (myParts ?? []).filter((p: any) => {
      const g = p.games;
      return g?.ends_at && new Date(g.ends_at) < new Date();
    });
    if (finished.length === 0) {
      setPending([]);
      return;
    }
    const gameIds = finished.map((p: any) => p.game_id);

    // 2. Which of these have I already reviewed someone in?
    const { data: myReviews } = await supabase
      .from("player_reviews")
      .select("game_id, reviewee_id")
      .eq("reviewer_id", user.id)
      .in("game_id", gameIds);
    const reviewedByGame = new Map<string, Set<string>>();
    for (const r of (myReviews ?? []) as any[]) {
      if (!reviewedByGame.has(r.game_id)) reviewedByGame.set(r.game_id, new Set());
      reviewedByGame.get(r.game_id)!.add(r.reviewee_id);
    }

    // 3. Get all confirmed co-participants for each finished game
    const { data: allParts } = await supabase
      .from("game_participants")
      .select("game_id, user_id")
      .in("game_id", gameIds)
      .eq("status", "confirmed");

    // 4. Build pending list: games with at least one co-participant not yet reviewed
    const byGame = new Map<string, string[]>();
    for (const p of (allParts ?? []) as any[]) {
      if (p.user_id === user.id) continue;
      const done = reviewedByGame.get(p.game_id);
      if (done?.has(p.user_id)) continue;
      if (!byGame.has(p.game_id)) byGame.set(p.game_id, []);
      byGame.get(p.game_id)!.push(p.user_id);
    }
    if (byGame.size === 0) {
      setPending([]);
      return;
    }

    // 5. Fetch co-participant profiles
    const allUserIds = Array.from(new Set([...byGame.values()].flat()));
    const { data: profs } = await (supabase as any)
      .from("profiles_public")
      .select("id, display_name, avatar_url")
      .in("id", allUserIds);
    const profMap = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));

    const titleMap = new Map<string, string>(
      finished.map((p: any) => [p.game_id, p.games?.title ?? "Jogo"]),
    );

    const out: PendingGame[] = [];
    for (const [game_id, userIds] of byGame) {
      out.push({
        game_id,
        game_title: titleMap.get(game_id) ?? "Jogo",
        coparticipants: userIds.map((uid) => {
          const p = profMap.get(uid);
          return {
            user_id: uid,
            display_name: p?.display_name ?? "Jogador",
            avatar_url: p?.avatar_url ?? null,
          };
        }),
      });
    }
    setPending(out);
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    setChecked(false);
    check().finally(() => setChecked(true));
  }, [loading, user, check, router.state.location.pathname]);

  if (!checked || pending.length === 0) return null;

  return (
    <ReviewFlow
      game={pending[0]}
      onDone={() => {
        // Re-check; if no more games pending, modal disappears
        check();
      }}
    />
  );
}

function ReviewFlow({ game, onDone }: { game: PendingGame; onDone: () => void }) {
  const { user } = useAuth();
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      game.coparticipants.map((c) => [c.user_id, { rating: 0, tags: new Set<string>(), comment: "" }]),
    ),
  );
  const [submitting, setSubmitting] = useState(false);

  const current = game.coparticipants[idx];
  const draft = drafts[current.user_id];
  const isLast = idx === game.coparticipants.length - 1;

  function update(patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [current.user_id]: { ...d[current.user_id], ...patch } }));
  }
  function toggleTag(tag: string) {
    const next = new Set(draft.tags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    update({ tags: next });
  }

  async function handleNext() {
    if (draft.rating < 1) return;
    if (!isLast) {
      setIdx(idx + 1);
      return;
    }
    if (!user) return;
    setSubmitting(true);
    const rows = game.coparticipants.map((c) => {
      const d = drafts[c.user_id];
      return {
        game_id: game.game_id,
        reviewer_id: user.id,
        reviewee_id: c.user_id,
        rating: d.rating,
        tags: Array.from(d.tags),
        comment: d.comment.trim().slice(0, 300) || null,
      };
    });
    const { error } = await (supabase as any).from("player_reviews").insert(rows);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Avaliações enviadas!");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-ink/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-md max-h-[95vh] overflow-y-auto bg-paper border-t-4 sm:border-4 border-ink rounded-t-2xl sm:rounded-2xl shadow-brutal">
        <div className="p-5 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink/60 font-bold">
              Avaliar jogadores · {idx + 1}/{game.coparticipants.length}
            </p>
            <p className="text-sm font-bold mt-1 line-clamp-1">{game.game_title}</p>
          </div>

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="size-14 rounded-full border-2 border-ink overflow-hidden bg-zap shrink-0 flex items-center justify-center font-bold text-lg">
              {current.avatar_url ? (
                <img src={current.avatar_url} alt="" className="size-full object-cover" />
              ) : (
                current.display_name.charAt(0).toUpperCase()
              )}
            </div>
            <h2 className="text-lg font-bold leading-tight">
              Como foi jogar com {current.display_name}?
            </h2>
          </div>

          {/* Rating */}
          <div className="flex justify-between items-end px-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => update({ rating: n })}
                className="p-1 transition-transform active:scale-95"
                aria-label={`${n} de 5`}
              >
                <StickFigure filled={draft.rating >= n} />
              </button>
            ))}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            {TAG_ROWS.map((row, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                {row.map((tag) => {
                  const active = draft.tags.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 text-xs font-bold border-2 border-ink rounded-full transition-colors ${
                        active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-ink/5"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Comment */}
          <textarea
            value={draft.comment}
            onChange={(e) => update({ comment: e.target.value })}
            placeholder="Algum comentário? (opcional)"
            rows={2}
            maxLength={300}
            className="w-full border-2 border-ink rounded-lg p-3 text-sm bg-paper resize-none focus:outline-none focus:ring-2 focus:ring-zap"
          />

          {/* Submit */}
          <button
            type="button"
            disabled={draft.rating < 1 || submitting}
            onClick={handleNext}
            className="w-full py-3 bg-zap border-2 border-ink rounded-lg font-bold text-ink disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-0.5 shadow-brutal"
          >
            {submitting ? "Enviando..." : isLast ? "Enviar avaliações ✓" : "Próximo →"}
          </button>
        </div>
      </div>
    </div>
  );
}
