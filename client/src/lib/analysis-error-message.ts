import { i18n, type AppLanguage } from "@/lib/i18n";

type AnalysisErrorPayload = {
  language: AppLanguage;
  errorCode?: string | null;
  errorMessage?: string | null;
};

const TIMEOUT_SIGNATURES = [
  "application failed to respond",
  "timed out",
  "timeout",
  "deadline exceeded",
];

function resolveSupportCode(errorCode?: string | null, errorMessage?: string | null): string {
  if (errorCode && errorCode.trim()) return errorCode.trim().toUpperCase();
  const raw = (errorMessage ?? "").toLowerCase();
  if (TIMEOUT_SIGNATURES.some((sig) => raw.includes(sig))) return "SMX-AN-408";
  return "SMX-AN-500";
}

export function buildAnalysisSupportMessage({
  language,
  errorCode,
  errorMessage,
}: AnalysisErrorPayload): string {
  const supportCode = resolveSupportCode(errorCode, errorMessage);
  return i18n(language, {
    fr: `Nous rencontrons un délai inhabituel pendant l'analyse. Merci de contacter le support avec le code ${supportCode}.`,
    en: `We are experiencing an unusual delay while processing your analysis. Please contact support and share code ${supportCode}.`,
  });
}
