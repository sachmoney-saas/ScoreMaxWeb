import * as React from "react";

export type AppLanguage = "en" | "fr";

const STORAGE_KEY = "scoremax.language";

function normalizeLanguage(value: string | null): AppLanguage | null {
  if (!value) return null;
  if (value === "en" || value === "fr") return value;
  return null;
}

export function getPreferredLanguage(): AppLanguage {
  if (typeof window === "undefined") return "en";

  const queryLang = normalizeLanguage(
    new URLSearchParams(window.location.search).get("lang"),
  );
  if (queryLang) return queryLang;

  const storedLang = normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
  if (storedLang) return storedLang;

  const browserLanguage = window.navigator.language?.toLowerCase() ?? "en";
  return browserLanguage.startsWith("fr") ? "fr" : "en";
}

export function useAppLanguage(): AppLanguage {
  const [language] = React.useState<AppLanguage>(() => getPreferredLanguage());
  return language;
}

export function i18n(
  language: AppLanguage,
  texts: { en: string; fr: string },
): string {
  return language === "fr" ? texts.fr : texts.en;
}
