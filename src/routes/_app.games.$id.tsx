import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Users, Zap, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reviews } from "@/components/reviews";

export const Route = createFileRoute("/_app/games/$id")({
  head: () => ({ meta: [{ title: "Jogo — PEGA" }] }),
  component: GameDetail,
});

function GameDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [armRaised, setArmRaised] = useState(false);

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("*,sports(name,emoji),venues(name,address),host:profiles!games_host_id_fkey(display_name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: participants } = useQuery({
    queryKey: ["participants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_participants")
        .select("user_id,profiles(display_name,sponsor_brand)")
        .eq("game_id", id);
      if (error) throw error;
      return data as any[];
    },
  });

  const joined = !!participants?.find((p) => p.user_id === user?.id);

  async function sayEu() {
    if (!user) return;
    setArmRaised(true);
    setTimeout(() => setArmRaised(false), 1600);
    const { error } = await supabase.from("game_participants").insert({ game_id: id, user_id: user.id });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("EU! Vaga garantida. 💪");
      qc.invalidateQueries({ queryKey: ["participants", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    }
  }

  async function leave() {
    if (!user) return;
    await supabase.from("game_participants").delete().eq("game_id", id).eq("user_id", user.id);
    qc.invalidateQueries({ queryKey: ["participants", id] });
  }

  if (isLoading || !game) {
    return (
      <main className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></main>
    );
  }

  const filled = participants?.length ?? 0;
  const start = new Date(game.starts_at);
  const free = game.price_cents === 0;

  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <button onClick={() => navigate({ to: "/discover" })} className="brutal-chip bg-paper mb-4">
        <ArrowLeft className="size-3" /> Voltar
      </button>

      <div className="brutal-card-lg p-5 bg-paper">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase text-ink/60">
              {game.sports?.emoji} {game.sports?.name}
            </span>
            <h1 className="text-3xl font-extrabold leading-tight mt-1">{game.title}</h1>
            <p className="text-xs text-ink/70 mt-1">por {game.host?.display_name}</p>
          </div>
          {game.urgency === "urgente" && (
            <span className="brutal-chip bg-pop text-paper"><Zap className="size-3" /> URGENTE</span>
          )}
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <Row icon={MapPin} text={`${game.venues?.name ?? "—"}${game.venues?.address ? " · " + game.venues.address : ""}`} />
          <Row icon={Users} text={`${filled}/${game.slots_total} confirmados`} />
          <div className="flex gap-2">
            <span className="brutal-chip bg-paper">
              {start.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </span>
            <span className="brutal-chip bg-paper">
              {start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className={cn("brutal-chip", free ? "bg-zap" : "bg-paper")}>
              {free ? "DE GRAÇA" : `R$ ${(game.price_cents / 100).toFixed(2)}`}
            </span>
          </div>
        </div>

        {game.description && (
          <p className="mt-4 text-sm text-ink/80 whitespace-pre-wrap">{game.description}</p>
        )}
      </div>

      <div className="mt-4">
        {joined ? (
          <button
            onClick={leave}
            className="brutal-card-lg w-full px-5 py-4 bg-paper font-bold uppercase active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Sair do jogo
          </button>
        ) : (
          <button
            onClick={sayEu}
            disabled={filled >= game.slots_total}
            className="brutal-card-lg w-full px-5 py-5 bg-pop text-paper font-extrabold text-2xl uppercase active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <span className={cn("inline-block transition-transform origin-bottom-left", armRaised && "animate-[arm_1.4s_ease-out]")}>🙋</span>
            EU!
          </button>
        )}
        <p className="mt-2 text-xs text-ink/60 text-center">
          {game.urgency === "urgente" ? "+10 pontos por atender uma urgência" : game.urgency === "normal" ? "+3 pontos" : "+1 ponto"}
        </p>
      </div>

      <h2 className="mt-8 text-lg font-bold uppercase">Quem confirmou</h2>
      <ul className="mt-2 grid gap-2">
        {participants?.map((p) => (
          <li key={p.user_id} className="brutal-card p-3 flex items-center gap-3 bg-paper">
            <div className="size-9 rounded-full bg-zap border-2 border-ink flex items-center justify-center font-bold">
              {p.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-bold">{p.profiles?.display_name}</p>
              {p.profiles?.sponsor_brand && (
                <p className="text-xs text-ink/60">patrocinador: {p.profiles.sponsor_brand}</p>
              )}
            </div>
          </li>
        ))}
        {participants?.length === 0 && (
          <li className="brutal-card p-4 text-center text-ink/60">Seja o primeiro a dizer EU.</li>
        )}
      </ul>

      {joined && <Chat gameId={id} />}

      <style>{`
        @keyframes arm {
          0% { transform: rotate(0) translateY(0); }
          25% { transform: rotate(-30deg) translateY(-6px); }
          55% { transform: rotate(-30deg) translateY(-6px); }
          100% { transform: rotate(0) translateY(0); }
        }
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
        .select("id,content,user_id,created_at,profiles(display_name)")
        .eq("game_id", gameId)
        .order("created_at");
      if (mounted) setMessages(data ?? []);
    })();
    const channel = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `game_id=eq.${gameId}` }, async (payload) => {
        const { data } = await supabase
          .from("messages")
          .select("id,content,user_id,created_at,profiles(display_name)")
          .eq("id", payload.new.id)
          .single();
        if (data) setMessages((m) => [...m, data]);
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
    await supabase.from("messages").insert({ game_id: gameId, user_id: user.id, content });
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold uppercase">Conversa do jogo</h2>
      <div ref={scrollRef} className="brutal-card mt-2 bg-paper p-3 max-h-80 overflow-y-auto grid gap-2">
        {messages.length === 0 && <p className="text-center text-sm text-ink/60 py-4">Sem mensagens ainda.</p>}
        {messages.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={cn("max-w-[80%] px-3 py-2 border-2 border-ink text-sm", mine ? "ml-auto bg-pop text-paper rounded-l-lg rounded-br-lg" : "bg-zap rounded-r-lg rounded-bl-lg")}>
              {!mine && <p className="text-[10px] font-bold uppercase opacity-70">{m.profiles?.display_name}</p>}
              {m.content}
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} className="input-brutal flex-1" placeholder="Mensagem…" maxLength={500} />
        <button className="brutal-card-lg px-4 bg-ink text-paper active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          <Send className="size-4" />
        </button>
      </form>
    </section>
  );
}
