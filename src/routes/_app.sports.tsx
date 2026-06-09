import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";

export const Route = createFileRoute("/_app/sports")({
  head: () => ({ meta: [{ title: "Esportes — PEGA" }] }),
  component: SportsList,
});

type Sport = { id: string; name: string; emoji: string; slug: string; avg_rating: number | null; total_reviews: number | null };

function SportsList() {
  const { data } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sports")
        .select("id,name,emoji,slug,avg_rating,total_reviews")
        .order("name");
      if (error) throw error;
      return data as Sport[];
    },
  });

  return (
    <main className="px-5 pt-8 pb-24 max-w-md mx-auto">
      <h1 className="text-4xl font-extrabold uppercase leading-none">
        Esportes<span className="text-pop">.</span>
      </h1>
      <p className="mt-1 text-sm text-[#888]">Tudo que dá pra jogar por aqui</p>

      <ul className="mt-6 grid grid-cols-2 gap-3">
        {data?.map((s) => (
          <li
            key={s.id}
            className="relative overflow-hidden bg-surface border border-border rounded-2xl p-4 flex flex-col items-center text-center"
          >
            <span className="absolute left-0 top-0 bottom-0 w-1 bg-pop" />
            <span className="text-4xl">{s.emoji}</span>
            <span className="mt-2 font-bold uppercase text-sm">{s.name}</span>
            {s.total_reviews && s.total_reviews > 0 ? (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-foreground/80">
                <Star className="size-3 fill-pop stroke-pop" />
                {s.avg_rating?.toFixed(1)} · {s.total_reviews}
              </span>
            ) : (
              <span className="mt-1 text-xs text-[#555]">Sem avaliações</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
