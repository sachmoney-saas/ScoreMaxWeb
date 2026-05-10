import { i18n, type AppLanguage } from "@/lib/i18n";
import { AnalysisJobAssetPreviewThumb } from "./AnalysisJobAssetPreviewThumb";

/** Miniature du scan `EYE_CLOSEUP` — masquée si l'URL répond 404 / erreur charge. */
export function EyeCloseupScanThumb({
  src,
  language,
  className,
  imgClassName,
  onUnavailable,
}: {
  src: string | null | undefined;
  language: AppLanguage;
  className?: string;
  imgClassName?: string;
  /** Appelé quand src est invalide (404 ou erreur réseau) pour permettre au parent de ré-agencer. */
  onUnavailable?: () => void;
}) {
  return (
    <AnalysisJobAssetPreviewThumb
      src={src}
      alt={i18n(language, {
        en: "Eye close-up from your scan",
        fr: "Gros plan œil de ta prise",
      })}
      className={className}
      imgClassName={imgClassName}
      onUnavailable={onUnavailable}
    />
  );
}
