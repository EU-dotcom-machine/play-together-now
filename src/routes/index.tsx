import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Zap, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Esportes Unidos — bora jogar?" },
      { name: "description", content: "Ache atividades rolando perto de você. Diga EU e levanta o braço." },
      { property: "og:title", content: "Esportes Unidos — bora jogar?" },
      { property: "og:description", content: "Ache atividades rolando perto de você." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/discover" replace />;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="relative px-5 pt-10 pb-12 overflow-hidden">
        <div className="absolute -top-20 -right-20 size-72 rounded-full bg-pop/90 border-2 border-ink" aria-hidden />
        <div className="absolute top-32 -left-16 size-48 rounded-full bg-zap border-2 border-ink" aria-hidden />

        <div className="relative max-w-md mx-auto">
          <span className="brutal-chip bg-zap">v1 • beta</span>
          <h1 className="mt-6 text-6xl font-extrabold leading-[0.9] uppercase">
            Bora<br />jogar<span className="text-pop">.</span>
          </h1>
          <p className="mt-5 text-lg font-medium text-ink/80 max-w-sm">
            Falta gente pra completar o time? O Esportes Unidos conecta você com atividades rolando agora, perto de você. Diga EU! e entra na atividade.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              to="/auth"
              className="brutal-card-lg flex items-center justify-between px-5 py-4 bg-ink text-paper font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Entrar / Criar conta <ArrowRight className="size-5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="max-w-md mx-auto grid gap-3">
          <Feature icon={Zap} title="Diga EU" text="Toque um botão, levante o braço, garanta sua vaga." />
          <Feature icon={MapPin} title="Perto de você" text="A gente mostra atividades por distância, em tempo real." />
          <Feature icon={Users} title="Match e chat" text="Confirmou? Já cai no grupo da atividade." />
        </div>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof Zap; title: string; text: string }) {
  return (
    <div className="brutal-card p-4 flex gap-4 items-start">
      <div className="brutal-card-lg shrink-0 bg-pop p-2 text-paper">
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="text-lg font-bold uppercase">{title}</h3>
        <p className="text-sm text-ink/70">{text}</p>
      </div>
    </div>
  );
}
