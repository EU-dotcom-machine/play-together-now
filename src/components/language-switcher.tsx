import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const LANGS = [
  { code: "pt-BR", label: "PT" },
  { code: "ja", label: "日本語" },
] as const;

// Seletor de idioma (PT / 日本語). A escolha é salva no localStorage pelo
// detector do i18next, persistindo entre visitas no mesmo dispositivo.
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language ?? "pt-BR";
  return (
    <div className={cn("inline-flex rounded-full bg-surface border border-border p-0.5", className)}>
      {LANGS.map((l) => {
        const active = current === l.code || (l.code === "pt-BR" && current.startsWith("pt"));
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => i18n.changeLanguage(l.code)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-bold transition-colors",
              active ? "bg-pop text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
