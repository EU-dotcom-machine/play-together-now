import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Search, Check, X } from "lucide-react";

export const Route = createFileRoute("/_app/friends")({
  head: () => ({ meta: [{ title: "Amigos — Esportes Unidos" }] }),
  component: FriendsPage,
});

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  points: number | null;
  avg_rating: number | null;
  total_reviews: number | null;
};

function RatingBadge({ avg, total }: { avg: number | null | undefined; total: number | null | undefined }) {
  if (!total || total <= 0) return null;
  return (
    <span className="text-xs text-[#FFB400] font-bold">
      ⭐ {Number(avg ?? 0).toFixed(1)} · {total} {total === 1 ? "avaliação" : "avaliações"}
    </span>
  );
}
type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};

function Avatar({ name }: { name?: string | null }) {
  return (
    <div className="size-10 rounded-full bg-pop text-[#111] flex items-center justify-center text-sm font-extrabold shrink-0">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function FriendsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["friends", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("friendships" as any)
        .select("id,requester_id,addressee_id,status")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      return (data ?? []) as unknown as Friendship[];
    },
  });

  const incoming = useMemo(
    () => rows.filter((r) => r.status === "pending" && r.addressee_id === user?.id),
    [rows, user?.id],
  );
  const accepted = useMemo(() => rows.filter((r) => r.status === "accepted"), [rows]);

  const otherIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.requester_id === user?.id ? r.addressee_id : r.requester_id);
    }
    return [...ids];
  }, [rows, user?.id]);

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["friend-profiles", otherIds.sort().join(",")],
    enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles_public")
        .select("id,display_name,avatar_url,points,avg_rating,total_reviews")
        .in("id", otherIds);
      const map: Record<string, Profile> = {};
      for (const p of (data ?? []) as Profile[]) map[p.id] = p;
      return map;
    },
  });

  const acceptedIds = useMemo(
    () =>
      accepted.map((r) => (r.requester_id === user?.id ? r.addressee_id : r.requester_id)),
    [accepted, user?.id],
  );

  const { data: gamesCountMap = {} } = useQuery({
    queryKey: ["friend-games-count", acceptedIds.sort().join(",")],
    enabled: acceptedIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("game_participants")
        .select("user_id")
        .in("user_id", acceptedIds)
        .eq("status", "confirmed");
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as { user_id: string }[]) {
        map[row.user_id] = (map[row.user_id] ?? 0) + 1;
      }
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
      const { data } = await (supabase as any)
        .from("profiles_public")
        .select("id,display_name,avatar_url,points")
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

  const friendsSorted = useMemo(() => {
    return [...accepted].sort((a, b) => {
      const aId = a.requester_id === user?.id ? a.addressee_id : a.requester_id;
      const bId = b.requester_id === user?.id ? b.addressee_id : b.requester_id;
      return (profilesMap[bId]?.points ?? 0) - (profilesMap[aId]?.points ?? 0);
    });
  }, [accepted, profilesMap, user?.id]);

  if (!user) return null;

  return (
    <main className="px-5 pt-8 pb-24 max-w-md mx-auto bg-[#111] min-h-screen">
      <h1 className="text-4xl font-extrabold uppercase leading-none text-white">
        Amigos<span className="text-pop">.</span>
      </h1>
      <p className="mt-1 text-sm text-[#888]">Conecte com a galera e jogue junto</p>

      {/* SEARCH */}
      <section className="mt-6 bg-[#1E1E1E] rounded-2xl p-3">
        <label className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#111] border border-[#2A2A2A]">
          <Search className="size-4 text-[#888]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar jogador por nome..."
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {p.display_name ?? "Sem nome"}
                    </p>
                    <p className="text-xs text-[#FFD600] font-bold">
                      ⚡ {p.points ?? 0} pts
                    </p>
                  </div>
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
      </section>

      {/* PENDENTES */}
      {incoming.length > 0 && (
        <section className="mt-6 grid gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#888]">
            Pendentes ({incoming.length})
          </h2>
          {incoming.map((r) => {
            const p = profilesMap[r.requester_id];
            return (
              <div
                key={r.id}
                className="bg-[#1E1E1E] rounded-2xl p-3 flex items-center gap-3"
              >
                <Avatar name={p?.display_name} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">
                    {p?.display_name ?? "Jogador"}
                  </p>
                  <p className="text-xs text-[#FFD600] font-bold">
                    ⚡ {p?.points ?? 0} pts
                  </p>
                </div>
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
                  className="px-3 py-1.5 rounded-full bg-surface border border-border text-white text-xs font-bold uppercase inline-flex items-center gap-1"
                >
                  <X className="size-3.5" /> Recusar
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* AMIGOS */}
      <section className="mt-6 grid gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#888]">
          Amigos ({accepted.length})
        </h2>
        {accepted.length === 0 ? (
          <p className="text-sm text-[#666]">Ainda sem amigos. Bora chamar a galera!</p>
        ) : (
          friendsSorted.map((r) => {
            const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
            const p = profilesMap[otherId];
            const games = gamesCountMap[otherId] ?? 0;
            return (
              <div
                key={r.id}
                className="bg-[#1E1E1E] rounded-2xl p-3 flex items-center gap-3"
              >
                <Avatar name={p?.display_name} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">
                    {p?.display_name ?? "Jogador"}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-[#FFD600] font-bold">
                      ⚡ {p?.points ?? 0} pts
                    </span>
                    <span className="text-xs text-[#888] font-bold">
                      🎮 {games} jogos
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="px-3 py-1.5 rounded-full bg-surface border border-border text-white text-xs font-bold uppercase"
                >
                  Remover
                </button>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
