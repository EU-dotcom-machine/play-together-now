import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Participant = { user_id: string; profiles?: { display_name?: string | null } | null };

export function Reviews({
  gameId,
  startsAt,
  durationMin,
  sportName,
  participants,
  joined,
}: {
  gameId: string;
  startsAt: string;
  durationMin: number;
  sportName?: string | null;
  participants: Participant[];
  joined: boolean;
}) {
  const { user } = useAuth();
  const endsAt = new Date(new Date(startsAt).getTime() + durationMin * 60_000);
  const ended = endsAt.getTime() <= Date.now();

  const [loading, setLoading] = useState(true);
  const [gameReviews, setGameReviews] = useState<any[]>([]);
  const [playerReviews, setPlayerReviews] = useState<any[]>([]);

  const myGameReview = gameReviews.find((r) => r.reviewer_id === user?.id);

  async function load() {
    setLoading(true);
    const [{ data: gr }, { data: pr }] = await Promise.all([
      supabase
        .from("game_reviews")
        .select("id,reviewer_id,rating,comment,created_at,profiles!game_reviews_reviewer_id_fkey(display_name)")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false }),
      supabase
        .from("player_reviews")
        .select("id,reviewer_id,reviewee_id,rating,comment,created_at")
        .eq("game_id", gameId),
    ]);
    setGameReviews(gr ?? []);
    setPlayerReviews(pr ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [gameId]);

  const avg =
    gameReviews.length > 0
      ? (gameReviews.reduce((s, r) => s + r.rating, 0) / gameReviews.length).toFixed(1)
      : null;

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold uppercase">Avaliações</h2>
        {avg && (
          <span className="brutal-chip bg-zap">
            <Star className="size-3 fill-ink" /> {avg} · {gameReviews.length}
          </span>
        )}
      </div>

      {!ended && (
        <p className="brutal-card mt-2 p-3 bg-paper text-sm text-ink/70">
          Avaliações liberam quando o jogo terminar ({endsAt.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}).
        </p>
      )}

      {ended && joined && !myGameReview && (
        <GameReviewForm gameId={gameId} sportName={sportName} onSaved={load} />
      )}

      {ended && joined && (
        <PlayerReviewsPanel
          gameId={gameId}
          participants={participants.filter((p) => p.user_id !== user?.id)}
          existing={playerReviews.filter((r) => r.reviewer_id === user?.id)}
          onSaved={load}
        />
      )}

      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="size-5 animate-spin" /></div>
      ) : (
        <ul className="mt-3 grid gap-2">
          {gameReviews.length === 0 && ended && (
            <li className="brutal-card p-4 text-center text-ink/60 text-sm">Ainda sem avaliações.</li>
          )}
          {gameReviews.map((r) => (
            <li key={r.id} className="brutal-card p-3 bg-paper">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">{r.profiles?.display_name ?? "Jogador"}</p>
                <Stars value={r.rating} />
              </div>
              {r.comment && <p className="text-sm mt-1 text-ink/80">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cn(!onChange && "cursor-default")}
          aria-label={`${n} estrelas`}
        >
          <Star
            style={{ width: size, height: size }}
            className={cn(n <= value ? "fill-pop stroke-ink" : "fill-none stroke-ink/40")}
          />
        </button>
      ))}
    </div>
  );
}

function GameReviewForm({
  gameId,
  sportName,
  onSaved,
}: {
  gameId: string;
  sportName?: string | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || rating === 0) {
      toast.error("Escolha uma nota");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("game_reviews").insert({
      game_id: gameId,
      reviewer_id: user.id,
      rating,
      comment: comment.trim().slice(0, 500) || null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Avaliação enviada!");
      setRating(0);
      setComment("");
      onSaved();
    }
  }

  return (
    <form onSubmit={submit} className="brutal-card-lg mt-3 p-4 bg-zap grid gap-3">
      <p className="font-bold uppercase text-sm">Como foi o jogo{sportName ? ` de ${sportName}` : ""}?</p>
      <Stars value={rating} onChange={setRating} size={28} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Deixe um comentário (opcional)"
        className="input-brutal resize-none"
      />
      <button
        disabled={saving}
        className="brutal-card-lg bg-pop text-paper font-extrabold uppercase py-3 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
      >
        {saving ? "Enviando…" : "Enviar avaliação"}
      </button>
    </form>
  );
}

function PlayerReviewsPanel({
  gameId,
  participants,
  existing,
  onSaved,
}: {
  gameId: string;
  participants: Participant[];
  existing: any[];
  onSaved: () => void;
}) {
  if (participants.length === 0) return null;
  return (
    <div className="mt-4 grid gap-2">
      <p className="font-bold uppercase text-sm">Avalie os jogadores</p>
      {participants.map((p) => {
        const done = existing.find((r) => r.reviewee_id === p.user_id);
        return (
          <PlayerRow
            key={p.user_id}
            gameId={gameId}
            revieweeId={p.user_id}
            name={p.profiles?.display_name ?? "Jogador"}
            done={done}
            onSaved={onSaved}
          />
        );
      })}
    </div>
  );
}

function PlayerRow({
  gameId,
  revieweeId,
  name,
  done,
  onSaved,
}: {
  gameId: string;
  revieweeId: string;
  name: string;
  done?: any;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(done?.rating ?? 0);
  const [comment, setComment] = useState(done?.comment ?? "");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!user || rating === 0) {
      toast.error("Escolha uma nota");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("player_reviews").insert({
      game_id: gameId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      comment: comment.trim().slice(0, 300) || null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Avaliação de ${name} enviada`);
      setOpen(false);
      onSaved();
    }
  }

  return (
    <div className="brutal-card bg-paper p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-sm">{name}</p>
        {done ? (
          <Stars value={done.rating} />
        ) : (
          <button onClick={() => setOpen((o) => !o)} className="brutal-chip bg-zap">
            {open ? "Cancelar" : "Avaliar"}
          </button>
        )}
      </div>
      {open && !done && (
        <div className="mt-3 grid gap-2">
          <Stars value={rating} onChange={setRating} size={24} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Comentário (opcional)"
            className="input-brutal resize-none"
          />
          <button
            onClick={submit}
            disabled={saving}
            className="brutal-card bg-pop text-paper font-bold uppercase py-2 text-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            {saving ? "Enviando…" : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
