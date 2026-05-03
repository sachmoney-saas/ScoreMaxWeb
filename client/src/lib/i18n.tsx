import * as React from "react";
import { useSearch } from "wouter";

export type AppLanguage = "en" | "fr";

export const LANGUAGE_STORAGE_KEY = "scoremax.language";

function normalizeLanguage(value: string | null): AppLanguage | null {
  if (!value) return null;
  if (value === "en" || value === "fr") return value;
  return null;
}

function detectBrowserLanguage(): AppLanguage {
  if (typeof window === "undefined") return "en";
  const browserLanguage = window.navigator.language?.toLowerCase() ?? "en";
  return browserLanguage.startsWith("fr") ? "fr" : "en";
}

/**
 * Resolution order: `?lang=` → localStorage → browser (`fr` vs default `en`).
 * Does not read React context (use before Provider mount or outside React).
 */
export function getPreferredLanguage(): AppLanguage {
  if (typeof window === "undefined") return "en";

  const queryLang = normalizeLanguage(
    new URLSearchParams(window.location.search).get("lang"),
  );
  if (queryLang) return queryLang;

  const storedLang = normalizeLanguage(
    window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
  );
  if (storedLang) return storedLang;

  return detectBrowserLanguage();
}

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function parseSearchToLang(search: string): AppLanguage | null {
  return normalizeLanguage(new URLSearchParams(search).get("lang"));
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const search = useSearch();
  const [language, setLanguageState] = React.useState<AppLanguage>(() =>
    typeof window !== "undefined" ? getPreferredLanguage() : "en",
  );

  React.useEffect(() => {
    const fromUrl = parseSearchToLang(search);
    if (!fromUrl) return;
    setLanguageState((prev) => {
      if (prev === fromUrl) return prev;
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, fromUrl);
      return fromUrl;
    });
  }, [search]);

  const setLanguage = React.useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  const value = React.useMemo(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useAppLanguage(): AppLanguage {
  const ctx = React.useContext(LanguageContext);
  if (ctx) return ctx.language;
  if (typeof window !== "undefined") return getPreferredLanguage();
  return "en";
}

export function useLanguage(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}

export function i18n(
  language: AppLanguage,
  texts: { en: string; fr: string },
): string {
  return language === "fr" ? texts.fr : texts.en;
}
