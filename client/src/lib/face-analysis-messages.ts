import type { AppLanguage } from "@/lib/i18n";
import { i18n } from "@/lib/i18n";

export function faceAnalysisMessage(
  lang: AppLanguage,
  key:
    | "r2BaseUrlMissing"
    | "mimeTypeInvalid"
    | "supabaseSessionMissing"
    | "signedUploadFailed"
    | "r2UploadFailed"
    | "scanAssetsSaveFailed"
    | "noScanAssets"
    | "downloadAssetFailed",
  detail?: string,
): string {
  switch (key) {
    case "r2BaseUrlMissing":
      return i18n(lang, {
        en: "Public R2 URL is not configured (VITE_R2_PUBLIC_BASE_URL).",
        fr: "L’URL publique R2 n’est pas configurée (VITE_R2_PUBLIC_BASE_URL).",
      });
    case "mimeTypeInvalid":
      return i18n(lang, {
        en: "Only JPG and PNG files are accepted.",
        fr: "Seuls les fichiers JPG et PNG sont acceptés.",
      });
    case "supabaseSessionMissing":
      return i18n(lang, {
        en: "Supabase session not found.",
        fr: "Session Supabase introuvable.",
      });
    case "signedUploadFailed":
      return i18n(lang, {
        en: "Could not prepare upload to storage.",
        fr: "Impossible de préparer l’upload sur le stockage.",
      });
    case "r2UploadFailed":
      return i18n(lang, {
        en: "Upload to storage failed.",
        fr: "Échec de l’upload vers le stockage.",
      });
    case "scanAssetsSaveFailed":
      return i18n(lang, {
        en: "Could not save scan metadata.",
        fr: "Impossible d’enregistrer les métadonnées du scan.",
      });
    case "noScanAssets":
      return i18n(lang, {
        en: "No scan assets found for this session.",
        fr: "Aucune photo de scan trouvée pour cette session.",
      });
    case "downloadAssetFailed":
      return i18n(lang, {
        en: `Unable to download asset${detail ? `: ${detail}` : "."}`,
        fr: `Impossible de télécharger l’asset${detail ? ` : ${detail}` : "."}`,
      });
    default: {
      const _exhaustive: never = key;
      return String(_exhaustive);
    }
  }
}
