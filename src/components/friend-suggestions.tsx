import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { UserPlus, Check, Trophy, Users } from "lucide-react";
import { friendlyError } from "@/lib/friendly-error";

type Suggestion = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  mutual_friends: number;
  played_together: number;
};

// Sugestões de amizade com sinais de confiança (já jogou com você / amigos em comum).
export function FriendSuggestions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["friend-suggestions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Suggestion[]> => {
      const { data, error } = await (supabase as any).rpc("get_friend_suggestions", { p_limit: 12 });
      if (error) throw error;
      return (data ?? []) as Suggestion[];
    },
  });

  async function add(id: string) {
    setSent((s) => ({ ...s, [id]: true }));
    const { error } = await supabase
      .from("friendships" as any)
      .insert({ requester_id: user!.id, addressee_id: id } as any);
    if (error) {
      setSent((s) => ({ ...s, [id]: false }));
      return toast.error(friendlyError(error));
    }
    toast.success("Pedido enviado!");
    qc.invalidateQueries({ queryKey: ["friends", user?.id] });
  }

  if (isLoading || suggestions.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Sugestões pra você
      </h2>
      <div className="mt-2 grid gap-2">
        {suggestions.map((s) => {
          const name = s.display_name ?? "Atleta";
          return (
            <div key={s.user_id} className="brutal-card p-3 flex items-center gap-3">
              {s.avatar_url ? (
                <img src={s.avatar_url} alt="" className="size-10 rounded-full object-cover border border-border shrink-0" />
              ) : (
                <div className="size-10 rounded-full bg-pop text-primary-foreground flex items-center justify-center text-sm font-extrabold shrink-0">
                  {name[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{name}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {s.played_together > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full bg-pop/15 text-pop px-2 py-0.5">
                      <Trophy className="size-3" /> Já jogou com você
                      {s.played_together > 1 ? ` · ${s.played_together}x` : ""}
                    </span>
                  )}
                  {s.mutual_friends > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full bg-surface border border-border text-muted-foreground px-2 py-0.5">
                      <Users className="size-3" /> {s.mutual_friends} amigo{s.mutual_friends > 1 ? "s" : ""} em comum
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={!!sent[s.user_id]}
                onClick={() => add(s.user_id)}
                className="px-3 py-1.5 rounded-full bg-pop text-primary-foreground text-xs font-bold uppercase inline-flex items-center gap-1 disabled:opacity-50 shrink-0"
              >
                {sent[s.user_id] ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
                {sent[s.user_id] ? "Enviado" : "Adicionar"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
