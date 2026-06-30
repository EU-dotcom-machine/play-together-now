import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const TAG_ROWS = [
  ["Pontual", "Respeitoso", "Animado", "Bem-humorado"],
  ["Habilidoso", "Justo no jogo", "Comunicativo", "Competitivo saudável"],
  ["Trabalho em equipe", "Voltaria a jogar", "Organizado", "Deixou o espaço limpo"],
];

const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

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
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingGame[]>([]);
  const [checked, setChecked] = useState(false);
  const mountedRef = useRef(true);
  const skipCheckRef = useRef(false);
  const skippedGamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const check = useCallback(async () => {
    if (!user) return;
    const nowMs = Date.now();

    // Helper: is a game finished AND within the 48h review window?
    const isFinishedRecent = (g: any) => {
      if (!g) return false;
      let endedAtMs: number | null = null;
      if (g.ends_at) endedAtMs = new Date(g.ends_at).getTime();
      else if (g.starts_at) {
        const dur = g.duration_minutes ?? g.duration_min ?? 120;
        endedAtMs = new Date(g.starts_at).getTime() + dur * 60_000;
      }
      if (endedAtMs == null) return false;
      if (endedAtMs >= nowMs) return false; // not finished yet
      if (nowMs - endedAtMs > MAX_AGE_MS) return false; // too old
      return true;
    };

    // 1a. Confirmed participations of mine
    const { data: myParts } = await supabase
      .from("game_participants")
      .select("game_id, games!inner(id,title,starts_at,ends_at,duration_min,duration_minutes,host_id)")
      .eq("user_id", user.id)
      .eq("status", "confirmed");

    // 1b. Games I hosted (host is implicit confirmed participant, may not be in game_participants)
    const { data: hosted } = await supabase
      .from("games")
      .select("id,title,starts_at,ends_at,duration_min,duration_minutes,host_id")
      .eq("host_id", user.id);

    type GInfo = { id: string; title: string; host_id: string };
    const finishedGames = new Map<string, GInfo>();
    for (const p of (myParts ?? []) as any[]) {
      const g = p.games;
      if (g && isFinishedRecent(g)) finishedGames.set(g.id, { id: g.id, title: g.title ?? "Jogo", host_id: g.host_id });
    }
    for (const g of (hosted ?? []) as any[]) {
      if (isFinishedRecent(g)) finishedGames.set(g.id, { id: g.id, title: g.title ?? "Jogo", host_id: g.host_id });
    }
    // Filter out games the user skipped locally during this session
    for (const id of skippedGamesRef.current) finishedGames.delete(id);

    if (finishedGames.size === 0) {
      if (mountedRef.current) setPending([]);
      return;
    }
    const gameIds = Array.from(finishedGames.keys());

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

    // 3. Get all CONFIRMED co-participants for each finished game
    const { data: allParts } = await supabase
      .from("game_participants")
      .select("game_id, user_id, status")
      .in("game_id", gameIds)
      .eq("status", "confirmed");

    // 4. Build pending list — exclude self, include host as implicit confirmed participant
    const byGame = new Map<string, Set<string>>();
    const addCandidate = (gameId: string, uid: string) => {
      if (uid === user.id) return; // exclude self
      const done = reviewedByGame.get(gameId);
      if (done?.has(uid)) return;
      if (!byGame.has(gameId)) byGame.set(gameId, new Set());
      byGame.get(gameId)!.add(uid);
    };

    for (const p of (allParts ?? []) as any[]) {
      addCandidate(p.game_id, p.user_id);
    }
    // Include host of each finished game as reviewable (if not me)
    for (const g of finishedGames.values()) {
      if (g.host_id) addCandidate(g.id, g.host_id);
    }

    if (byGame.size === 0) {
      if (mountedRef.current) setPending([]);
      return;
    }

    // 5. Fetch co-participant profiles
    const allUserIds = Array.from(new Set([...byGame.values()].flatMap((s) => [...s])));
    const { data: profs } = await (supabase as any)
      .from("profiles_public")
      .select("id, display_name, avatar_url")
      .in("id", allUserIds);
    const profMap = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));

    const out: PendingGame[] = [];
    for (const [game_id, userIds] of byGame) {
      out.push({
        game_id,
        game_title: finishedGames.get(game_id)?.title ?? "Jogo",
        coparticipants: Array.from(userIds).map((uid) => {
          const p = profMap.get(uid);
          return {
            user_id: uid,
            display_name: p?.display_name ?? "Jogador",
            avatar_url: p?.avatar_url ?? null,
          };
        }),
      });
    }
    if (mountedRef.current) setPending(out);
  }, [user]);


  useEffect(() => {
    if (loading || !user) return;
    if (skipCheckRef.current) {
      skipCheckRef.current = false;
      setChecked(true);
      return;
    }
    setChecked(false);
    check().finally(() => {
      if (mountedRef.current) setChecked(true);
    });
  }, [loading, user, check, router.state.location.pathname]);

  if (!checked || pending.length === 0) return null;

  const current = pending[0];

  return (
    <ReviewFlow
      key={current.game_id}
      game={current}
      onDone={() => {
        if (mountedRef.current) {
          skipCheckRef.current = true;
          setPending([]);
          navigate({ to: "/agenda" });
        }
      }}
      onSkipGame={() => {
        // Mark this game as skipped locally and advance to the next pending game (if any)
        skippedGamesRef.current.add(current.game_id);
        if (mountedRef.current) {
          const remaining = pending.slice(1);
          setPending(remaining);
          if (remaining.length === 0) {
            skipCheckRef.current = true;
            navigate({ to: "/discover" });
          }
        }
      }}
    />
  );
}

function ReviewFlow({
  game,
  onDone,
  onSkipGame,
}: {
  game: PendingGame;
  onDone: () => void;
  onSkipGame: () => void;
}) {
  const { user } = useAuth();
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      game.coparticipants.map((c) => [c.user_id, { rating: 0, tags: new Set<string>(), comment: "" }]),
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

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
    try {
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
      if (error) {
        // Never trap the user: skip this game locally and advance.
        setFailedAttempts((n) => n + 1);
        toast.error("Não foi possível enviar a avaliação. Pulando este jogo.");
        onSkipGame();
        return;
      }
      toast.success("Avaliações enviadas!");
      onDone();
    } catch {
      setFailedAttempts((n) => n + 1);
      toast.error("Erro ao enviar avaliação. Pulando este jogo.");
      onSkipGame();
    } finally {
      setSubmitting(false);
    }
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

          {/* Last-resort skip after a failed attempt */}
          {failedAttempts >= 1 && (
            <button
              type="button"
              onClick={onSkipGame}
              className="w-full py-2 text-xs font-bold text-ink/60 underline"
            >
              Pular avaliação e continuar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
