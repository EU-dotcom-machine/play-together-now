import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ptBR from "@/locales/pt-BR.json";
import ja from "@/locales/ja.json";

// Internacionalização. PT-BR é o padrão/fallback; JA (japonês) é a 2ª língua.
// No cliente, detecta pelo localStorage e depois pelo idioma do navegador
// (ex.: navegador em japonês -> "ja"). No servidor (SSR) usa PT-BR.
const resources = {
  "pt-BR": { translation: ptBR },
  ja: { translation: ja },
};

if (!i18n.isInitialized) {
  const instance = i18n.use(initReactI18next);
  if (typeof window !== "undefined") {
    instance.use(LanguageDetector);
  }
  instance.init({
    resources,
    fallbackLng: "pt-BR",
    supportedLngs: ["pt-BR", "ja"],
    // NÃO usar nonExplicitSupportedLngs aqui: com supportedLngs contendo região
    // ("pt-BR"), essa opção faz o i18next resolver "pt-BR" -> "pt" (sem recursos)
    // e o t() devolve as chaves cruas. Sem ela, "ja-JP"->"ja" e "pt-*"->"pt-BR"
    // resolvem corretamente via fallback. (Bug diagnosticado 17/07.)
    lng: typeof window === "undefined" ? "pt-BR" : undefined,
    // Recursos são embutidos (sem backend) -> init SÍNCRONO (initAsync=false na
    // v26). Sem isso, o React renderiza antes do init terminar e os textos
    // ficam presos nas chaves.
    initAsync: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "eu_lang",
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  });
}

export default i18n;
