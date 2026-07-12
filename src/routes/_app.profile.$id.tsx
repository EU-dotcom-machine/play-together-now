import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, ArrowLeft } from "lucide-react";
import { StickFigureRating } from "@/components/stick-figure-rating";
import { brandGradient } from "@/lib/brands";

export const Route = createFileRoute("/_app/profile/$id")({
  head: () => ({ meta: [{ title: "Atleta — Esportes Unidos" }] }),
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles_public")
        .select("id,display_name,avatar_url,sponsor_brand,points,avg_rating,total_reviews,bio,skill_level")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return <main className="max-w-md mx-auto p-6 text-center text-ink/60">Carregando…</main>;
  }
  if (!profile) {
    return (
      <main className="max-w-md mx-auto p-6 text-center">
        <p className="text-ink/60">Atleta não encontrado.</p>
        <Link to="/discover" className="text-pop font-bold underline mt-3 inline-block">
          Voltar
        </Link>
      </main>
    );
  }

  const name = profile.display_name || "Atleta";

  return (
    <main className="max-w-md mx-auto pb-24">
      <header
        className="px-5 pt-10 pb-12"
        style={{ background: brandGradient(profile.sponsor_brand ?? null) }}
      >
        <Link to="/discover" className="inline-flex items-center gap-1 text-white/80 text-xs mb-4">
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-pop text-[#111] flex items-center justify-center text-2xl font-extrabold overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="size-16 rounded-full object-cover" />
            ) : (
              name[0]?.toUpperCase()
            )}
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-[#888]">atleta</p>
            <h1 className="text-2xl font-extrabold leading-none text-pop">{name}</h1>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 bg-pop text-[#111] px-3 py-1.5 rounded-full text-xs font-bold">
            <Trophy className="size-3.5" /> {profile.points ?? 0} pontos
          </div>
          {(profile.total_reviews ?? 0) > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-black/30 text-white px-3 py-1.5 rounded-full">
              <StickFigureRating
                value={Number(profile.avg_rating ?? 0)}
                total={profile.total_reviews}
                size="sm"
              />
            </div>
          )}
        </div>
      </header>

      <section className="px-5 py-6 grid gap-3">
        {profile.bio && (
          <div>
            <p className="text-xs uppercase font-bold text-ink/60">Bio</p>
            <p className="mt-1">{profile.bio}</p>
          </div>
        )}
        {profile.skill_level && (
          <div>
            <p className="text-xs uppercase font-bold text-ink/60">Nível</p>
            <p className="mt-1">{profile.skill_level}</p>
          </div>
        )}
      </section>
    </main>
  );
}
