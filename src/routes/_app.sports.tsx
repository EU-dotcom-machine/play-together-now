import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/sports")({
  head: () => ({ meta: [{ title: "Esportes — PEGA" }] }),
  component: SportsList,
});

type Sport = { id: string; name: string; emoji: string; slug: string };

function SportsList() {
  const { data } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sports")
        .select("id,name,emoji,slug")
        .order("name");
      if (error) throw error;
      return data as Sport[];
    },
  });

  return (
    <main className="px-5 pt-8 max-w-md mx-auto">
      <h1 className="text-4xl font-extrabold uppercase leading-none">
        Esportes<span className="text-pop">.</span>
      </h1>
      <p className="mt-1 text-sm text-ink/70">Tudo que dá pra jogar por aqui</p>

      <ul className="mt-6 grid grid-cols-2 gap-3">
        {data?.map((s) => (
          <li
            key={s.id}
            className="brutal-card-lg p-4 bg-paper flex flex-col items-center text-center"
          >
            <span className="text-4xl">{s.emoji}</span>
            <span className="mt-2 font-bold uppercase text-sm">{s.name}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
