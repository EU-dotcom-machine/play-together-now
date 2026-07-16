import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/friendly-error";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Users, Zap, Send, Loader2, Hourglass, Check, Share2, LogOut } from "lucide-react";
import { cn, formatDateDisplay } from "@/lib/utils";
import { getCourtImage } from "@/lib/sport-courts";
import { Reviews } from "@/components/reviews";
import { CandidatesPanel } from "@/components/candidates-panel";
import { trackEvent } from "@/lib/posthog";
import { AddFriendButton } from "@/components/add-friend-button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/games/$id")({
  head: () => ({ meta: [{ title: "Atividade — Esportes Unidos" }] }),
  component: GameDetail,
});

type Participant = {
  user_id: string;
  status: "pending" | "confirmed" | "declined";
  profiles: { id: string; display_name: string; sponsor_brand?: string | null; avg_rating?: number | null; total_reviews?: number | null } | null;
};

function GameDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [armRaised, setArmRaised] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("*,sports(name,emoji),venues(name,address)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: host } = await (supabase as any)
        .from("profiles_public")
        .select("display_name")
        .eq("id", data.host_id)
        .maybeSingle();
      return { ...data, host } as any;
    },
  });

  const { data: participants } = useQuery({
    queryKey: ["participants", id],
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase
        .from("game_participants")
        .select("user_id,status" as any)
        .eq("game_id", id);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = rows.map((p) => p.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await (supabase as any)
        .from("profiles_public")
        .select("id,display_name,sponsor_brand,avg_rating,total_reviews")
        .in("id", ids);
      return rows.map((p) => ({
        user_id: p.user_id,
        status: (p.status ?? "pending") as Participant["status"],
        profiles: ((profs ?? []) as any[]).find((pr: any) => pr.id === p.user_id) ?? null,
      }));
    },
  });

  const { data: myVenueClaim } = useQuery({
    queryKey: ["venue_claim_game", user?.id, (game as any)?.venue_id],
    queryFn: async () => {
      if (!user || !(game as any)?.venue_id) return null;
      const { data, error } = await supabase
        .from("venue_claims")
        .select("id")
        .eq("claimant_id", user.id)
        .eq("venue_id", (game as any).venue_id)
        .eq("status", "accepted")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!(game as any)?.venue_id,
  });

  // Realtime: refresh participants on any change
  useEffect(() => {
    const channel = supabase
      .channel(`participants-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_participants", filter: `game_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["participants", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const myEntry = participants?.find((p) => p.user_id === user?.id) ?? null;
  const myStatus = myEntry?.status ?? null;

  // Detect transition pending -> confirmed for the current user => celebrate
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === "pending" && myStatus === "confirmed") {
      setCelebrate(true);
      trackEvent("game_joined", { game_id: id });
      setTimeout(() => setCelebrate(false), 2200);
    }
    if (prev === "pending" && myStatus === "declined") {
      toast("Não foi dessa vez. Tente novamente.");
    }
    prevStatusRef.current = myStatus;
  }, [myStatus, id]);

  async function sayEu() {
    if (!user) return;
    if (game) {
      const _now = new Date();
      const _end = (game as any).ends_at ? new Date((game as any).ends_at) : (game.duration_min ? new Date(new Date(game.starts_at).getTime() + game.duration_min * 60000) : null);
      if (new Date(game.starts_at) <= _now || (_end && _end <= _now)) {
        return toast.error("Inscrições encerradas");
      }
    }
    trackEvent("eu_button_clicked", { game_id: id });
    setArmRaised(true);
    setTimeout(() => setArmRaised(false), 1600);
    // If a declined row exists, reset it back to pending; otherwise insert.
    if (myEntry?.status === "declined") {
      const { error } = await supabase
        .from("game_participants")
        .update({ status: "pending" } as any)
        .eq("game_id", id)
        .eq("user_id", user.id);
      if (error) return toast.error(friendlyError(error));
    } else {
      const { error } = await supabase
        .from("game_participants")
        .insert({ game_id: id, user_id: user.id, status: "pending" } as any);
      if (error) return toast.error(friendlyError(error));
    }
    toast.success("Pedido enviado! Aguarde a confirmação.");
    qc.invalidateQueries({ queryKey: ["participants", id] });
  }


  async function leave() {
    if (!user) return;
    const { error } = await supabase.from("game_participants").delete().eq("game_id", id).eq("user_id", user.id);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ["participants", id] });
  }


  if (isLoading || !game) {
    return (
      <main className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></main>
    );
  }

  const isHost = user?.id === game.host_id;
  const confirmed = (participants ?? []).filter((p) => p.status === "confirmed" && p.user_id !== game.host_id);
  
  const filled = confirmed.length;
  const slotsTotal = game.slots_total;
  const remaining = Math.max(0, slotsTotal - filled);
  const start = new Date(game.starts_at);
  const free = game.price_cents === 0;
  const full = filled >= slotsTotal;
  const now = new Date();
  const endsAt = (game as any).ends_at ? new Date((game as any).ends_at) : (game.duration_min ? new Date(start.getTime() + game.duration_min * 60000) : null);
  const started = start <= now || (endsAt ? endsAt <= now : false);

  const imageUrl = getCourtImage(game.sports?.name);

  const slotsLabel = full
    ? "Completo"
    : filled === 0
      ? `Aguardando ${slotsTotal} ${slotsTotal === 1 ? "atleta" : "atletas"}`
      : `${filled}/${slotsTotal} confirmados`;

  const chatUnlocked = isHost || myStatus === "confirmed";

  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <div className="flex items-center justify-between gap-2 mb-4">
        <button onClick={() => navigate({ to: "/discover" })} className="brutal-chip bg-paper">
          <ArrowLeft className="size-3" /> Voltar
        </button>
        <button
          onClick={() => {
            const gameUrl = window.location.href;
            const date = formatDateDisplay(start, {
              weekday: "long", day: "2-digit", month: "long",
            });
            const time = formatDateDisplay(start, {
              hour: "2-digit", minute: "2-digit",
            });
            const price = game.price_cents === 0
              ? "de graça"
              : "R$ " + (game.price_cents / 100).toFixed(2);
            const sportName = game.sports?.name ?? "";
            const sportActionMap: Record<string, string> = {
              "Corrida": "Bora correr!",
              "Ciclismo": "Bora pedalar!",
              "Surf": "Bora surfar!",
              "Skate": "Bora skatear!",
              "Natação": "Bora nadar!",
              "MMA": "Bora treinar MMA!",
              "Crossfit": "Bora fazer Crossfit!",
              "Futebol": "Bora jogar Futebol!",
              "Futsal": "Bora jogar Futsal!",
              "Basquete": "Bora jogar Basquete!",
              "Vôlei": "Bora jogar Vôlei!",
              "Handebol": "Bora jogar Handebol!",
              "Tênis": "Bora jogar Tênis!",
              "Padel": "Bora jogar Padel!",
              "Beach Tennis": "Bora jogar Beach Tennis!",
              "Pickleball": "Bora jogar Pickleball!",
            };
            const action = sportActionMap[sportName] ?? (sportName ? `Bora jogar ${sportName}!` : "Bora jogar!");
            const text = encodeURIComponent(
              `🏅 ${action}\n\n` +
              `*${game.title}*\n` +
              `📍 ${game.venues?.name}\n` +
              `📅 ${date} às ${time}\n` +
              `💰 ${price}\n\n` +
              `Diz EU! e entra na atividade 👇\n${gameUrl}`
            );
            window.open(`https://wa.me/?text=${text}`, "_blank");
          }}
          className="brutal-chip bg-paper"
        >
          <Share2 className="size-3" /> Compartilhar
        </button>
      </div>

      <div
        className="brutal-card-lg p-5 relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.85)), url(${imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase text-ink/60">
                {game.sports?.emoji} {game.sports?.name}
              </span>
              <h1 className="text-3xl font-extrabold leading-tight mt-1">{game.title}</h1>
              <p className="text-xs text-ink/70 mt-1">por {game.host?.display_name}</p>
            </div>
            {game.urgency === "urgente" && (
              <span className="brutal-chip bg-urgent text-white"><Zap className="size-3" /> URGENTE</span>
            )}
          </div>

          <div className="mt-4 grid gap-2 text-sm">
            <Row icon={MapPin} text={`${game.venues?.name ?? "—"}${game.venues?.address ? " · " + game.venues.address : ""}`} />
            {myVenueClaim && (
              <Link to="/venue-panel" className="text-xs font-bold text-ink/60 hover:text-ink hover:underline">
                Ver painel do espaço →
              </Link>
            )}
            <Row icon={Users} text={slotsLabel} />
            <div className="flex gap-2 flex-wrap">
              <span className="brutal-chip bg-paper">
                {formatDateDisplay(start, { weekday: "long", day: "2-digit", month: "long" })}
              </span>
              <span className="brutal-chip bg-paper">
                {formatDateDisplay(start, { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className={cn("brutal-chip", free ? "bg-zap text-[#111]" : "bg-paper")}>
                {free ? "DE GRAÇA" : `R$ ${(game.price_cents / 100).toFixed(2)}`}
              </span>
            </div>
          </div>

          {game.description && (
            <p className="mt-4 text-sm text-ink/80 whitespace-pre-wrap">{game.description}</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        {isHost ? (
          <div className="brutal-card-lg w-full px-5 py-4 bg-ink text-paper font-bold uppercase text-center">
            Você é o organizador
          </div>
        ) : myStatus === "confirmed" ? (
          <div className="flex flex-col gap-2">
            <div
              className="w-full px-5 py-5 font-extrabold text-xl uppercase rounded-full flex items-center justify-center gap-2 cursor-default"
              style={{ background: "#2D6A4F", color: "#fff" }}
            >
              <Check className="size-5" /> Confirmado!
            </div>
            <button
              onClick={() => setShowLeaveDialog(true)}
              className="w-auto mx-auto px-4 py-2 text-xs font-bold uppercase rounded-full bg-transparent border flex items-center gap-2"
              style={{ borderColor: "#FF4444", color: "#FF4444" }}
            >
              <LogOut className="size-3" /> Sair da atividade
            </button>
          </div>
        ) : myStatus === "pending" ? (
          <button
            disabled
            className="w-full px-5 py-5 font-bold text-base uppercase rounded-full flex items-center justify-center gap-2 cursor-not-allowed"
            style={{ background: "#2A2A2A", color: "#888" }}
          >
            <Hourglass className="size-5" /> Aguardando confirmação…
          </button>
        ) : started ? (
          <div
            className="w-full px-5 py-5 font-bold text-base uppercase rounded-full flex items-center justify-center gap-2"
            style={{ background: "#2A2A2A", color: "#888" }}
          >
            Atividade iniciada
          </div>
        ) : (
          <button
            onClick={sayEu}
            disabled={full}
            className="w-full px-5 py-5 bg-pop text-[#111] font-extrabold text-2xl uppercase rounded-full active:translate-y-[1px] disabled:opacity-50 flex items-center justify-center gap-3 shadow-[0_8px_24px_rgba(255,214,0,0.25)]"
          >
            <span className={cn("inline-block transition-transform origin-bottom-left", armRaised && "animate-[arm_1.4s_ease-out]")}>🙋</span>
            {full ? "Completo" : "EU!"}
          </button>
        )}

        {!isHost && myStatus !== "confirmed" && myStatus !== "pending" && (
          <p className="mt-2 text-xs text-ink/60 text-center">
            {game.urgency === "urgente" ? "+5 pontos ao ser confirmado em urgência" : game.urgency === "normal" ? "+3 pontos" : "+1 ponto"}
          </p>
        )}
      </div>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="bg-[#1A1A1A] border-[#333] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que quer sair da atividade?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowLeaveDialog(false)} className="bg-surface text-white border-none hover:bg-surface/80">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={leave} className="bg-[#FF4444] text-white hover:bg-[#FF4444]/90">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isHost && (
        <CandidatesPanel
          gameId={id}
          gameLat={game.latitude ?? null}
          gameLng={game.longitude ?? null}
          slotsTotal={slotsTotal}
          gameStatus={game.status}
          sportId={game.sport_id ?? null}
        />
      )}


      <div className="mt-8 brutal-card p-3 bg-zap flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase text-[#111]/70">Criado por</p>
          <p className="font-bold text-[#111] truncate">{game.host?.display_name ?? "—"}</p>
        </div>
        {game.host_id && user && user.id !== game.host_id && (
          <AddFriendButton targetId={game.host_id} />
        )}
      </div>


      <h2 className="mt-6 text-lg font-bold uppercase">Quem confirmou</h2>
      <ul className="mt-2 grid gap-2">
        {confirmed.map((p) => (
          <li key={p.user_id} className="brutal-card p-3 flex items-center gap-3 bg-paper">
            <div className="size-9 rounded-full bg-zap border border-ink/20 flex items-center justify-center font-bold text-[#111]">
              {p.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {p.profiles?.id ? (
                  <Link
                    to="/profile/$id"
                    params={{ id: p.profiles.id }}
                    className="font-bold truncate hover:underline"
                  >
                    {p.profiles?.display_name}
                  </Link>
                ) : (
                  <p className="font-bold truncate">{p.profiles?.display_name}</p>
                )}
                {(p.profiles?.total_reviews ?? 0) > 0 && p.profiles?.id && (
                  <Link
                    to="/profile/$id"
                    params={{ id: p.profiles.id }}
                    className="shrink-0 inline-flex items-center gap-0.5 bg-ink/10 text-ink px-1.5 py-0.5 rounded-full text-[10px] font-bold hover:bg-ink/20"
                  >
                    ⭐ {Number(p.profiles?.avg_rating ?? 0).toFixed(1)}
                  </Link>
                )}
              </div>

              {p.profiles?.sponsor_brand && (
                <p className="text-xs text-ink/60">patrocinador: {p.profiles.sponsor_brand}</p>
              )}
            </div>
            {p.profiles?.id && <AddFriendButton targetId={p.profiles.id} />}
          </li>
        ))}
        {Array.from({ length: remaining }).map((_, i) => (
          <li key={`empty-${i}`} className="brutal-card p-3 text-center text-ink/40 text-sm">
            vaga aberta
          </li>
        ))}
      </ul>

      {chatUnlocked && <Chat gameId={id} />}

      {celebrate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-[fadeIn_0.2s_ease-out]">
          <div className="text-center">
            <div className="text-[120px] leading-none animate-[pop_0.6s_ease-out]">🙋</div>
            <p className="mt-2 text-6xl font-extrabold uppercase text-pop tracking-tight">EU!</p>
            <p className="mt-3 text-lg font-bold text-white">Você foi confirmado!</p>
          </div>
        </div>
      )}

      <Reviews
        gameId={id}
        startsAt={game.starts_at}
        durationMin={game.duration_min}
        sportName={game.sports?.name}
        participants={confirmed}
        joined={myStatus === "confirmed"}
      />

      <style>{`
        @keyframes arm {
          0% { transform: rotate(0) translateY(0); }
          25% { transform: rotate(-30deg) translateY(-6px); }
          55% { transform: rotate(-30deg) translateY(-6px); }
          100% { transform: rotate(0) translateY(0); }
        }
        @keyframes pop {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </main>
  );
}

function Row({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return (
    <div className="flex items-center gap-2 text-ink/80">
      <Icon className="size-4" /> <span>{text}</span>
    </div>
  );
}

function Chat({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id,content,user_id,created_at")
        .eq("game_id", gameId)
        .order("created_at");
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = ids.length
        ? await (supabase as any).from("profiles_public").select("id,display_name").in("id", ids)
        : { data: [] as any[] };
      const withProfiles = rows.map((r) => ({
        ...r,
        profiles: ((profs ?? []) as any[]).find((p: any) => p.id === r.user_id) ?? null,
      }));
      if (mounted) setMessages(withProfiles);
    })();
    const channel = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `game_id=eq.${gameId}` }, async (payload) => {
        const { data } = await supabase
          .from("messages")
          .select("id,content,user_id,created_at")
          .eq("id", payload.new.id)
          .maybeSingle();
        if (!data) return;
        const { data: prof } = await (supabase as any)
          .from("profiles_public")
          .select("display_name")
          .eq("id", data.user_id)
          .maybeSingle();
        setMessages((m) => [...m, { ...data, profiles: prof }]);
      })
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !text.trim()) return;
    const content = text.trim().slice(0, 500);
    setText("");
    const { error } = await supabase.from("messages").insert({ game_id: gameId, user_id: user.id, content });
    if (error) {
      // Restaura o texto para o usuário não perder a mensagem digitada.
      setText(content);
      toast.error("Não foi possível enviar a mensagem. Tente novamente.");
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold uppercase">Conversa da atividade</h2>
      <div ref={scrollRef} className="brutal-card mt-2 bg-paper p-3 max-h-80 overflow-y-auto grid gap-2">
        {messages.length === 0 && <p className="text-center text-sm text-ink/60 py-4">Sem mensagens ainda.</p>}
        {messages.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={cn("max-w-[80%] px-3 py-2 border border-ink/20 text-sm rounded-lg", mine ? "ml-auto bg-pop text-[#111]" : "bg-[#2A2A2A] text-white")}>
              {!mine && <p className="text-[10px] font-bold uppercase opacity-70">{m.profiles?.display_name}</p>}
              {m.content}
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} className="input-brutal flex-1" placeholder="Mensagem…" maxLength={500} />
        <button className="brutal-card-lg px-4 bg-pop text-[#111] font-bold">
          <Send className="size-4" />
        </button>
      </form>
    </section>
  );
}
