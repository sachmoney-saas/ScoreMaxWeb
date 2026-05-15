import * as React from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { saasGlassInsetClassName } from "@/lib/auth-page-shell-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { OnboardingPotentialImage } from "@/hooks/use-onboarding-potential-image";
import { OnboardingGlassLoader } from "@/components/onboarding/OnboardingGlassLoader";
import { OnboardingPotentialAnalysisMock } from "@/components/onboarding/OnboardingPotentialAnalysisMock";
import {
  getScoreRank,
  GLOBAL_TIER_SEGMENTS,
  SCORE_TIERS,
} from "@/lib/global-score-tiers";

type Props = {
  language: AppLanguage;
  potentialImage: OnboardingPotentialImage | null | undefined;
  isLoading: boolean;
};

/** Score global fictif (0–100) pour positionner le curseur comme sur la fiche analyse. */
const POTENTIAL_SCORE_TEASER_GLOBAL = 87;

function tierLadderCursorPercent(score0to100: number, rankIndex: number): number {
  const n = SCORE_TIERS.length;
  const seg = GLOBAL_TIER_SEGMENTS[rankIndex];
  if (!seg) return 0;
  const { lower, upper } = seg;
  const span = Math.max(1e-6, upper - lower);
  const clamped = Math.max(lower, Math.min(upper, score0to100));
  const t = (clamped - lower) / span;
  return ((rankIndex + Math.max(0, Math.min(1, t))) / n) * 100;
}

function PotentialScoreBlurredTierBar({
  score0to100,
  language,
}: {
  score0to100: number;
  language: AppLanguage;
}) {
  const activeIndex = getScoreRank(score0to100).index;
  const cursorLeftPct = tierLadderCursorPercent(score0to100, activeIndex);

  return (
    <div
      className="pointer-events-none select-none blur-[6px] motion-safe:blur-[7px] sm:blur-[9px]"
      role="img"
      aria-label={i18n(language, {
        en: "Blurred score tier bar",
        fr: "Barre de paliers de score floutée",
      })}
    >
      <div className="relative pb-px">
        <div className="relative">
          <div className="flex items-center gap-1">
            {SCORE_TIERS.map((_, i) => {
              const isActive = i === activeIndex;
              const isPast = i < activeIndex;
              const isNext = !isActive && !isPast && i === activeIndex + 1;
              return (
                <div key={i} className="flex flex-1 items-center gap-1">
                  <div
                    className={cn(
                      "relative h-1.5 flex-1 overflow-hidden rounded-full transition",
                      isActive &&
                        "bg-gradient-to-b from-white/90 to-zinc-400/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_0_0_1px_rgba(255,255,255,0.12),0_2px_8px_rgba(0,0,0,0.35)]",
                      isPast && "bg-white/40",
                      isNext &&
                        "bg-white/[0.14] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]",
                      !isActive && !isPast && !isNext && "bg-white/10",
                    )}
                  >
                    {isNext ? (
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 w-[min(90%,4rem)] min-w-[1.25rem] rounded-full bg-gradient-to-r from-transparent via-white/55 to-transparent motion-safe:animate-brand-loader-shimmer motion-reduce:opacity-70"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
            <div
              className="absolute top-1/2 h-7 w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-white via-white to-white/25 shadow-[0_0_16px_rgba(255,255,255,0.45),0_0_0_0.5px_rgba(255,255,255,0.85)] motion-reduce:h-6 motion-reduce:shadow-[0_0_10px_rgba(255,255,255,0.3)] sm:h-8"
              style={{ left: `${cursorLeftPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PotentialScanScoreTeaser({ language }: { language: AppLanguage }) {
  return (
    <div
      className={cn(
        saasGlassInsetClassName,
        "w-full space-y-3 px-4 py-4 text-left sm:px-5",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
        {i18n(language, { en: "Your score", fr: "Ton score" })}
      </p>
      <PotentialScoreBlurredTierBar
        score0to100={POTENTIAL_SCORE_TEASER_GLOBAL}
        language={language}
      />
      <p className="text-xs leading-relaxed text-zinc-400">
        {i18n(language, {
          en: "Unlock to see your real score and personalized roadmap.",
          fr: "Débloque pour voir ton vrai score et ta feuille de route personnalisée.",
        })}
      </p>
    </div>
  );
}

/**
 * Affichage post-scan : score flouté + image "potentiel dans 6 mois"
 * générée via OneShot / Nano Banana. L'utilisateur ne sait pas qu'aucune
 * vraie analyse n'a tourné — la vraie analyse est lancée après paiement.
 */
export function PotentialPreviewCard({
  language,
  potentialImage,
  isLoading,
}: Props) {
  const signedUrl = potentialImage?.signed_url ?? null;
  const leftSrc = potentialImage?.mask_overlay_signed_url ?? null;

  const [leftDecoded, setLeftDecoded] = React.useState(false);
  const [rightDecoded, setRightDecoded] = React.useState(false);

  React.useEffect(() => {
    setLeftDecoded(false);
  }, [leftSrc]);

  React.useEffect(() => {
    setRightDecoded(false);
  }, [signedUrl]);

  const status = potentialImage?.status ?? "pending";
  const isReady = status === "completed" && !!signedUrl;
  const isFailed = status === "failed";
  const rightSrc = isReady && signedUrl ? signedUrl : null;

  const blockingMessage = i18n(language, {
    en: "Generating your potential…",
    fr: "Génération de ton potentiel…",
  });

  const showBlockingLoader =
    !isFailed &&
    ((isLoading && potentialImage == null) ||
      (!!leftSrc && !leftDecoded) ||
      (!!rightSrc && !rightDecoded));

  if (showBlockingLoader) {
    return (
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-1 py-2 sm:px-2 sm:py-4">
        <OnboardingGlassLoader message={blockingMessage} />
        {leftSrc ? (
          <img
            src={leftSrc}
            alt=""
            decoding="async"
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
            onLoad={() => setLeftDecoded(true)}
            onError={() => setLeftDecoded(true)}
          />
        ) : null}
        {rightSrc ? (
          <img
            src={rightSrc}
            alt=""
            decoding="async"
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
            onLoad={() => setRightDecoded(true)}
            onError={() => setRightDecoded(true)}
          />
        ) : null}
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-4 sm:gap-5">
        <PotentialScanScoreTeaser language={language} />

        <div
          className={cn(
            saasGlassInsetClassName,
            "relative isolate flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden p-6 text-center",
          )}
        >
          <Sparkles className="h-6 w-6 text-zinc-400" />
          <p className="mt-3 text-sm text-zinc-200">
            {i18n(language, {
              en: "We couldn't preview your potential right now.",
              fr: "Impossible d'afficher ton potentiel pour le moment.",
            })}
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            {i18n(language, {
              en: "You can still unlock your full analysis below.",
              fr: "Tu peux quand même débloquer ton analyse complète ci-dessous.",
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-4 sm:gap-5">
      <PotentialScanScoreTeaser language={language} />

      <div
        role="img"
        aria-label={i18n(language, {
          en: "Current look and your potential",
          fr: "Ton look actuel et ton potentiel",
        })}
        className="relative w-full max-w-[min(100%,24rem)] self-center sm:max-w-md"
      >
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          <div className="relative min-h-0 overflow-hidden rounded-xl border border-white/15 bg-black/25 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.7)]">
            {leftSrc ? (
              <img
                src={leftSrc}
                alt={i18n(language, {
                  en: "Front face with mesh overlay",
                  fr: "Visage de face avec maillage",
                })}
                decoding="async"
                draggable={false}
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 bg-black/30 p-3">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-zinc-400" />
              </div>
            )}
          </div>
          <div className="relative min-h-0 overflow-hidden rounded-xl border border-white/15 bg-black/25 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.7)]">
            {rightSrc ? (
              <img
                src={rightSrc}
                alt={i18n(language, {
                  en: "Your AI-generated potential",
                  fr: "Ton potentiel généré par IA",
                })}
                decoding="async"
                draggable={false}
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.12),transparent_55%),linear-gradient(180deg,rgba(20,28,40,0.55),rgba(10,16,22,0.75))] p-3">
                <Loader2 className="h-6 w-6 shrink-0 animate-spin text-white/80" />
                <p className="text-center text-[11px] font-medium leading-snug text-white/85 sm:text-xs">
                  {blockingMessage}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-[rgba(10,16,22,0.72)] text-white shadow-[0_8px_28px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md sm:h-12 sm:w-12">
            <ArrowRight
              className="h-[1.35rem] w-[1.35rem] shrink-0 sm:h-6 sm:w-6"
              strokeWidth={2.4}
              aria-hidden
            />
          </span>
        </div>
      </div>

      <OnboardingPotentialAnalysisMock language={language} />
    </div>
  );
}
