import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { ArrowRight, Zap, MapPin, Users } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useEffect, useState } from "react";


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
  const { t } = useTranslation();
  const words = ["JOGAR", "CORRER", "NADAR", "SURFAR", "TREINAR", "EVOLUIR", "CRESCER"];
  const [wordIndex, setWordIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setAnimate(true);
      setWordIndex((i) => i + 1);
    }, 2000);
    return () => clearInterval(id);
  }, []);
  const handleTransitionEnd = () => {
    if (wordIndex === words.length) {
      setAnimate(false);
      setWordIndex(0);
    }
  };


  if (loading) return null;
  if (user) return <Navigate to="/discover" replace />;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="relative px-5 pt-10 pb-12 overflow-hidden">
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-pop/90 border-2 border-ink" aria-hidden />
        <div className="absolute -top-24 -left-20 size-52 rounded-full bg-zap border-2 border-ink" aria-hidden />

        <div className="relative z-10 max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <span className="brutal-chip bg-zap">{t("landing.beta")}</span>
            <LanguageSwitcher />
          </div>
          <h1 className="mt-6 text-6xl font-extrabold leading-[0.9] uppercase [text-shadow:0_2px_14px_rgba(0,0,0,0.45)]">
            {t("landing.title_line1")}<br />
            <span className="inline-flex items-baseline align-baseline">
              <span
                className="relative overflow-hidden inline-block align-baseline"
                style={{ height: "1em" }}
              >
                <span
                  className={`flex flex-col ${animate ? "transition-transform duration-500 ease-out" : ""}`}
                  style={{ transform: `translateY(-${wordIndex}em)` }}
                  aria-live="polite"
                  onTransitionEnd={handleTransitionEnd}
                >
                  {[...words, words[0]].map((w, i) => (
                    <span key={`${w}-${i}`} className="block leading-[1]" style={{ height: "1em" }}>
                      {w}
                    </span>
                  ))}
                </span>

              </span>
              <span className="text-pop">{t("landing.dot")}</span>
            </span>
          </h1>

          <p className="mt-5 text-lg font-medium text-ink max-w-sm">{t("landing.subtitle")}</p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              to="/auth"
              className="brutal-card-lg flex items-center justify-between px-5 py-4 bg-ink text-paper font-bold uppercase tracking-wide transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              {t("landing.cta")} <ArrowRight className="size-5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="max-w-md mx-auto grid gap-3">
          <Feature icon={Zap} title={t("landing.feature1_title")} text={t("landing.feature1_text")} />
          <Feature icon={MapPin} title={t("landing.feature2_title")} text={t("landing.feature2_text")} />
          <Feature icon={Users} title={t("landing.feature3_title")} text={t("landing.feature3_text")} />
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
