import * as React from "react";
import { motion } from "framer-motion";
import { Flag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { onboardingPrimaryCtaClassName } from "@/lib/cta-button-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { OnboardingPotentialImage } from "@/hooks/use-onboarding-potential-image";
import { useAuthenticatedImageObjectUrl } from "@/hooks/use-authenticated-image-object-url";
import { OnboardingMultistepGlassLoader } from "@/components/onboarding/OnboardingMultistepGlassLoader";
import { BeforeAfterSlider } from "@/components/onboarding/BeforeAfterSlider";
import { beforeAfterMediaFrameClassName } from "@/lib/onboarding-portrait-media";

type Props = {
  language: AppLanguage;
  potentialImage: OnboardingPotentialImage | null | undefined;
  isLoading: boolean;
  suppressPreview?: boolean;
  onUnlock: () => void | Promise<void>;
  isUnlocking: boolean;
};

const POTENTIAL_MULTISTEP_STEPS = [
  {
    en: "Reading your scan…",
    fr: "Lecture de ton scan…",
  },
  {
    en: "Generating your potential…",
    fr: "Génération de ton potentiel…",
  },
  {
    en: "Finalizing the preview…",
    fr: "Finalisation de l’aperçu…",
  },
] as const;

const DREAM_FACE_PROGRESS_PCT = 14;

const dreamFaceCardClassName =
  "w-full max-w-none shrink-0 rounded-2xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(2,4,8,0.97)_0%,rgba(0,1,4,0.99)_100%)] p-[clamp(0.75rem,1.8vh,1.25rem)] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_24px_-12px_rgba(0,0,0,0.65)]";

/** Cible affichée : aujourd'hui + 12 semaines (84 jours). */
function useTwelveWeekTargetDate(): Date {
  return React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 12 * 7);
    return d;
  }, []);
}

function DreamFaceProgressCard({ language }: { language: AppLanguage }) {
  const targetDate = useTwelveWeekTargetDate();
  const targetDateLabel = React.useMemo(
    () =>
      targetDate.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [language, targetDate],
  );
  const targetDateIso = React.useMemo(() => {
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, [targetDate]);

  return (
    <div
      className={dreamFaceCardClassName}
    >
      <div className="flex items-center gap-2 sm:gap-2.5">
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <Flag
            className="size-4 shrink-0 text-[#d6e4ff] sm:size-[1.15rem]"
            strokeWidth={2}
            aria-hidden
          />
          <p className="whitespace-nowrap text-[clamp(0.62rem,1.4vh,0.75rem)] font-bold uppercase leading-tight tracking-wide text-[#d6e4ff] sm:text-xs">
            {i18n(language, {
              en: "Your Dream Face",
              fr: "Ton visage rêvé",
            })}
          </p>
        </div>
        <div
          className="min-w-[2.5rem] flex-1 self-center px-0.5 sm:px-1"
          role="progressbar"
          aria-valuenow={DREAM_FACE_PROGRESS_PCT}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={i18n(language, {
            en: "Progress toward your dream face",
            fr: "Progression vers ton visage rêvé",
          })}
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.14]">
            <div
              className="h-full rounded-full bg-[#d6e4ff] shadow-[0_0_12px_rgba(214,228,255,0.45)]"
              style={{ width: `${DREAM_FACE_PROGRESS_PCT}%` }}
            />
          </div>
        </div>

        <time
          dateTime={targetDateIso}
          className="max-w-[min(11rem,42%)] shrink-0 text-right text-[clamp(0.72rem,1.5vh,0.8125rem)] font-semibold leading-tight tabular-nums text-white sm:max-w-none sm:text-sm"
        >
          {targetDateLabel}
        </time>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[clamp(0.65rem,1.35vh,0.75rem)] sm:mt-3 sm:text-[0.8125rem]">
        <p className="min-w-0 leading-snug text-zinc-400">
          <span className="font-medium text-zinc-300">
            {i18n(language, {
              en: "Ultimate NPC",
              fr: "Ultimate NPC",
            })}
          </span>
          <span className="mx-1 text-zinc-500" aria-hidden>
            →
          </span>
          <span className="font-semibold text-[#d6e4ff]">
            {i18n(language, {
              en: "High Tier Normie",
              fr: "High Tier Normie",
            })}
          </span>
        </p>
        <span className="shrink-0 tabular-nums text-zinc-500">
          {i18n(language, {
            en: "12 weeks",
            fr: "12 semaines",
          })}
        </span>
      </div>
    </div>
  );
}

function TransformationPreviewHeader({
  language,
  subtitle,
}: {
  language: AppLanguage;
  subtitle: { en: string; fr: string };
}) {
  return (
    <header className="w-full shrink-0 text-center">
      <h2
        className={cn(
          "font-hero mx-auto max-w-[min(100%,22ch)] font-semibold tracking-[-0.02em] text-balance text-white sm:max-w-[min(100%,28ch)] md:max-w-[min(100%,32ch)]",
          // Tailles 100% fluides en `vh` : le titre rétrécit avec la hauteur
          // dispo (et grossit sur les grands écrans) pour rester lisible
          // sans pousser le CTA hors de la vue.
          "text-[clamp(1.1rem,3vh,2.1rem)] leading-[1.08]",
        )}
      >
        {i18n(language, {
          en: "Your Transformation Preview",
          fr: "Ton aperçu transformation",
        })}
      </h2>
      <p className="mt-[clamp(0.2rem,0.6vh,0.5rem)] text-[clamp(0.78rem,1.5vh,0.875rem)] leading-snug text-zinc-300">
        {i18n(language, subtitle)}
      </p>
    </header>
  );
}

function UnlockFullAnalysisCta({
  language,
  onUnlock,
  isUnlocking,
}: {
  language: AppLanguage;
  onUnlock: () => void | Promise<void>;
  isUnlocking: boolean;
}) {
  return (
    <div
      className="flex w-full shrink-0 flex-col items-center"
      role="region"
      aria-label={i18n(language, {
        en: "Continue",
        fr: "Continuer",
      })}
    >
      <button
        type="button"
        onClick={() => void onUnlock()}
        disabled={isUnlocking}
        className={cn(
          "mx-auto flex w-full min-w-[10.5rem] max-w-full items-center justify-center gap-2 rounded-sm px-6 py-[clamp(0.55rem,1.4vh,0.875rem)] transition disabled:pointer-events-none disabled:opacity-60",
          onboardingPrimaryCtaClassName,
        )}
      >
        {isUnlocking ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
        ) : null}
        <span className="text-center text-[clamp(0.85rem,1.7vh,1rem)] font-semibold tracking-tight">
          {i18n(language, {
            en: "Continue",
            fr: "Continuer",
          })}
        </span>
      </button>
    </div>
  );
}

function PreviewMediaSkeleton() {
  return (
    <div className="w-full shrink-0 self-center">
      <div
        className={cn(
          beforeAfterMediaFrameClassName,
          "overflow-hidden bg-white/[0.04]",
        )}
        aria-hidden
      >
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.1)_42%,rgba(255,255,255,0.03)_78%)]" />
      </div>
    </div>
  );
}

/**
 * Affichage post-scan : avant / après avec slider superposé.
 */
export function PotentialPreviewCard({
  language,
  potentialImage,
  isLoading,
  suppressPreview = false,
  onUnlock,
  isUnlocking,
}: Props) {
  const generatedMediaUrl = potentialImage?.generated_media_url ?? null;
  const sourceMediaUrl =
    potentialImage?.source_face_media_url ??
    potentialImage?.mask_overlay_media_url ??
    null;
  const usesAuthenticatedMedia = Boolean(generatedMediaUrl);
  const generatedImage = useAuthenticatedImageObjectUrl(generatedMediaUrl, {
    enabled: usesAuthenticatedMedia,
  });
  const sourceImage = useAuthenticatedImageObjectUrl(sourceMediaUrl, {
    enabled: usesAuthenticatedMedia && Boolean(sourceMediaUrl),
  });

  const legacySignedUrl = potentialImage?.signed_url ?? null;
  const legacySignedUrlAvif = potentialImage?.signed_url_avif ?? null;
  /** Côté « actuel » : photo source du scan (identique à l’entrée OneShot), sans masque filaire. */
  const legacyBeforeSrc =
    potentialImage?.source_face_signed_url ??
    potentialImage?.mask_overlay_signed_url ??
    null;
  const legacyBeforeSrcAvif =
    potentialImage?.source_face_signed_url_avif ??
    potentialImage?.mask_overlay_signed_url_avif ??
    null;

  const status = potentialImage?.status ?? "pending";
  const displayState = potentialImage?.display_state;
  const isReady =
    displayState === "ready" ||
    (status === "completed" && Boolean(generatedMediaUrl ?? legacySignedUrl));
  const isFailed = status === "failed" || displayState === "unavailable";
  const mediaUnavailable =
    usesAuthenticatedMedia && generatedImage.status === "unavailable";
  const mediaLoading =
    usesAuthenticatedMedia &&
    isReady &&
    generatedImage.status !== "ready" &&
    generatedImage.status !== "unavailable";
  const beforeSrc = usesAuthenticatedMedia
    ? sourceImage.objectUrl
    : legacyBeforeSrc;
  const beforeSrcAvif = usesAuthenticatedMedia ? null : legacyBeforeSrcAvif;
  const afterSrc = usesAuthenticatedMedia
    ? generatedImage.objectUrl
    : isReady && legacySignedUrl
      ? legacySignedUrl
      : null;
  const afterSrcAvif = usesAuthenticatedMedia
    ? null
    : isReady && legacySignedUrlAvif
      ? legacySignedUrlAvif
      : null;

  const showBlockingLoader =
    !suppressPreview &&
    !isFailed &&
    (isLoading || !isReady);

  if (showBlockingLoader) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="mx-auto flex w-full max-w-full flex-col items-stretch gap-[clamp(0.4rem,1.2vh,1rem)] px-0"
      >
        <TransformationPreviewHeader
          language={language}
          subtitle={{
            en: "We're preparing your preview from your scan — just a few seconds.",
            fr: "On prépare ton aperçu à partir de ton scan — encore quelques secondes.",
          }}
        />
        <motion.div
          className="w-full shrink-0 self-center"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut", delay: 0.03 }}
        >
          <div className="mx-auto flex w-full flex-col items-center">
            <div
              className={cn(
                beforeAfterMediaFrameClassName,
                "flex items-center justify-center p-3 sm:p-4",
              )}
            >
              <OnboardingMultistepGlassLoader
                language={language}
                steps={POTENTIAL_MULTISTEP_STEPS}
                cycleResetKey="potential"
                variant="featured"
                className="w-full border-white/10 bg-black/35 shadow-none"
              />
            </div>
          </div>
        </motion.div>
        <div
          className={cn(
            dreamFaceCardClassName,
            "pointer-events-none select-none",
          )}
          aria-hidden
        >
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="h-4 w-28 animate-pulse rounded bg-white/10 sm:h-5 sm:w-36" />
            <div className="h-1 min-w-[2.5rem] flex-1 animate-pulse rounded-full bg-white/10" />
            <div className="h-4 w-20 animate-pulse rounded bg-white/10 sm:h-5 sm:w-24" />
          </div>
          <div className="mt-2.5 flex justify-between gap-2 sm:mt-3">
            <div className="h-3 w-48 animate-pulse rounded bg-white/[0.08] sm:h-3.5" />
            <div className="h-3 w-14 animate-pulse rounded bg-white/[0.08] sm:h-3.5" />
          </div>
        </div>
        <div
          className="h-[clamp(2.25rem,5.5vh,3rem)] w-full shrink-0 animate-pulse rounded-sm bg-white/10"
          aria-hidden
        />
      </motion.div>
    );
  }

  if (isFailed || suppressPreview || mediaUnavailable) {
    return (
      <div className="mx-auto flex w-full max-w-full flex-col items-stretch gap-[clamp(0.4rem,1.2vh,1rem)] px-0">
        <DreamFaceProgressCard language={language} />
        <UnlockFullAnalysisCta
          language={language}
          onUnlock={onUnlock}
          isUnlocking={isUnlocking}
        />
      </div>
    );
  }

  if (mediaLoading) {
    return (
      <div className="mx-auto flex w-full max-w-full flex-col items-stretch gap-[clamp(0.4rem,1.2vh,1rem)] px-0">
        <TransformationPreviewHeader
          language={language}
          subtitle={{
            en: "See how ScoreMax can help you reach your potential.",
            fr: "Découvre comment ScoreMax peut t'aider à atteindre ton potentiel.",
          }}
        />
        <PreviewMediaSkeleton />
        <DreamFaceProgressCard language={language} />
        <UnlockFullAnalysisCta
          language={language}
          onUnlock={onUnlock}
          isUnlocking={isUnlocking}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-full flex-col items-stretch gap-[clamp(0.4rem,1.2vh,1rem)] px-0">
      <TransformationPreviewHeader
        language={language}
        subtitle={{
          en: "See how ScoreMax can help you reach your potential.",
          fr: "Découvre comment ScoreMax peut t'aider à atteindre ton potentiel.",
        }}
      />
      <motion.div
        className="w-full shrink-0 self-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <BeforeAfterSlider
          language={language}
          beforeSrc={beforeSrc}
          beforeSrcAvif={beforeSrcAvif}
          afterSrc={afterSrc}
          afterSrcAvif={afterSrcAvif}
          className="mx-auto"
        />
      </motion.div>
      <DreamFaceProgressCard language={language} />
      <UnlockFullAnalysisCta
        language={language}
        onUnlock={onUnlock}
        isUnlocking={isUnlocking}
      />
    </div>
  );
}
