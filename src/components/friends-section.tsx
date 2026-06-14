import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Search, Check, X, Users } from "lucide-react";

type Profile = { id: string; display_name: string | null; avatar_url: string | null };
type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
};

export function usePendingRequestCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["friend-requests-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("friendships" as any)
        .select("id", { count: "exact", head: true })
        .eq("addressee_id", user!.id)
        .eq("status", "pending");
      return count ?? 0;
    },
  });
}

export function FriendsSection() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["friends", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("friendships" as any)
        .select("*")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      return (data ?? []) as unknown as Friendship[];
    },
  });

  const incoming = useMemo(
    () => rows.filter((r) => r.status === "pending" && r.addressee_id === user?.id),
    [rows, user?.id],
  );
  const accepted = useMemo(() => rows.filter((r) => r.status === "accepted"), [rows]);

  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.requester_id === user?.id ? r.addressee_id : r.requester_id);
    }
    return [...ids];
  }, [rows, user?.id]);

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["friend-profiles", profileIds.sort().join(",")],
    enabled: profileIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", profileIds);
      const map: Record<string, Profile> = {};
      for (const p of (data ?? []) as Profile[]) map[p.id] = p;
      return map;
    },
  });

  // Search
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .ilike("display_name", `%${t}%`)
        .neq("id", user?.id ?? "")
        .limit(10);
      if (!cancelled) setResults((data ?? []) as Profile[]);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, user?.id]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["friends", user?.id] });
    qc.invalidateQueries({ queryKey: ["friend-requests-count", user?.id] });
  };

  async function sendRequest(targetId: string) {
    const existing = rows.find(
      (r) =>
        (r.requester_id === user?.id && r.addressee_id === targetId) ||
        (r.requester_id === targetId && r.addressee_id === user?.id),
    );
    if (existing) return toast.info("Já existe um pedido com esse jogador");
    const { error } = await supabase
      .from("friendships" as any)
      .insert({ requester_id: user!.id, addressee_id: targetId } as any);
    if (error) return toast.error(error.message);
    toast.success("Pedido enviado!");
    invalidate();
  }

  async function accept(id: string) {
    const { error } = await supabase
      .from("friendships" as any)
      .update({ status: "accepted" } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("friendships" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  }

  if (!user) return null;

  return (
    <section className="grid gap-4">
      <h2 className="text-base font-bold uppercase tracking-wide text-foreground flex items-center gap-2">
        <Users className="size-4 text-pop" /> Amigos
      </h2>

      {/* Search */}
      <div className="bg-[#1E1E1E] rounded-2xl p-3">
        <label className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#111] border border-[#2A2A2A]">
          <Search className="size-4 text-[#888]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar jogador pelo nome"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#666] outline-none"
          />
        </label>
        {results.length > 0 && (
          <ul className="mt-2 grid gap-2">
            {results.map((p) => {
              const f = rows.find(
                (r) =>
                  (r.requester_id === user.id && r.addressee_id === p.id) ||
                  (r.requester_id === p.id && r.addressee_id === user.id),
              );
              const label = f
                ? f.status === "accepted"
                  ? "Amigos"
                  : "Pendente"
                : "Adicionar";
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#2A2A2A]"
                >
                  <Avatar name={p.display_name} />
                  <p className="flex-1 text-sm font-semibold text-white">
                    {p.display_name ?? "Sem nome"}
                  </p>
                  <button
                    type="button"
                    disabled={!!f}
                    onClick={() => sendRequest(p.id)}
                    className="px-3 py-1 text-xs rounded-full bg-pop text-[#111] font-bold uppercase disabled:opacity-50"
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {q.trim().length >= 2 && results.length === 0 && (
          <p className="mt-2 text-xs text-[#666] px-2">Ninguém encontrado.</p>
        )}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#888]">
            Pedidos recebidos ({incoming.length})
          </p>
          {incoming.map((r) => {
            const p = profilesMap[r.requester_id];
            return (
              <div
                key={r.id}
                className="bg-[#1E1E1E] rounded-2xl p-3 flex items-center gap-3"
              >
                <Avatar name={p?.display_name} />
                <p className="flex-1 font-semibold text-white text-sm">
                  {p?.display_name ?? "Jogador"}
                </p>
                <button
                  type="button"
                  onClick={() => accept(r.id)}
                  className="px-3 py-1.5 rounded-full bg-pop text-[#111] text-xs font-bold uppercase inline-flex items-center gap-1"
                >
                  <Check className="size-3.5" /> Aceitar
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="px-3 py-1.5 rounded-full bg-[#111] border border-[#2A2A2A] text-white text-xs font-bold uppercase inline-flex items-center gap-1"
                >
                  <X className="size-3.5" /> Recusar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Accepted friends */}
      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[#888]">
          Seus amigos ({accepted.length})
        </p>
        {accepted.length === 0 ? (
          <p className="text-sm text-[#666]">Ainda sem amigos. Bora chamar a galera!</p>
        ) : (
          accepted.map((r) => {
            const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
            const p = profilesMap[otherId];
            return (
              <div
                key={r.id}
                className="bg-[#1E1E1E] rounded-2xl p-3 flex items-center gap-3"
              >
                <Avatar name={p?.display_name} />
                <p className="flex-1 font-semibold text-white text-sm">
                  {p?.display_name ?? "Jogador"}
                </p>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="px-3 py-1.5 rounded-full bg-[#111] border border-[#2A2A2A] text-white text-xs font-bold uppercase"
                >
                  Remover
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function Avatar({ name }: { name?: string | null }) {
  return (
    <div className="size-9 rounded-full bg-pop text-[#111] flex items-center justify-center text-sm font-extrabold">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
