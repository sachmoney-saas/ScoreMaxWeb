import * as React from "react";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saasGlassInsetClassName,
} from "@/lib/auth-page-shell-styles";
import { onboardingPrimaryCtaClassName } from "@/lib/cta-button-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { OnboardingPotentialImage } from "@/hooks/use-onboarding-potential-image";

type Props = {
  language: AppLanguage;
  potentialImage: OnboardingPotentialImage | null | undefined;
  isLoading: boolean;
  onUnlock: () => void;
  isUnlocking: boolean;
};

const POTENTIAL_SCORE_DISPLAY = "8.7";

/**
 * Affichage post-scan : score flouté + image "potentiel dans 6 mois"
 * générée via OneShot / Nano Banana. L'utilisateur ne sait pas qu'aucune
 * vraie analyse n'a tourné — la vraie analyse est lancée après paiement.
 */
export function PotentialPreviewCard({
  language,
  potentialImage,
  isLoading,
  onUnlock,
  isUnlocking,
}: Props) {
  const status = potentialImage?.status ?? "pending";
  const isReady = status === "completed" && potentialImage?.signed_url;
  const isFailed = status === "failed";

  const headline = i18n(language, {
    en: "Here's your potential in 6 months",
    fr: "Voici ton potentiel dans 6 mois",
  });

  const subline = i18n(language, {
    en:
      "A glimpse of what you could look like after a consistent looksmaxxing protocol. Unlock the full analysis to start.",
    fr:
      "Un aperçu de ce à quoi tu pourrais ressembler après un protocole looksmaxxing constant. Débloque l'analyse complète pour commencer.",
  });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center sm:gap-5">
      <h2 className="font-hero text-2xl font-semibold leading-[1.06] tracking-[-0.015em] text-white sm:text-3xl">
        {headline}
      </h2>
      <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
        {subline}
      </p>

      <div
        className={cn(
          saasGlassInsetClassName,
          "relative isolate flex aspect-[4/5] w-full overflow-hidden",
        )}
      >
        {isReady && potentialImage?.signed_url ? (
          <img
            src={potentialImage.signed_url}
            alt={i18n(language, {
              en: "Your AI-generated potential",
              fr: "Ton potentiel généré par IA",
            })}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : isFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Sparkles className="h-6 w-6 text-zinc-400" />
            <p className="text-sm text-zinc-200">
              {i18n(language, {
                en: "We couldn't preview your potential right now.",
                fr: "Impossible d'afficher ton potentiel pour le moment.",
              })}
            </p>
            <p className="text-xs text-zinc-400">
              {i18n(language, {
                en: "You can still unlock your full analysis below.",
                fr: "Tu peux quand même débloquer ton analyse complète ci-dessous.",
              })}
            </p>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.16),transparent_55%),linear-gradient(180deg,rgba(20,28,40,0.7),rgba(10,16,22,0.85))] p-6 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-white/80" />
            <p className="text-sm font-medium text-white/90">
              {i18n(language, {
                en: "Analyzing your face…",
                fr: "Analyse de ton visage en cours…",
              })}
            </p>
            <p className="text-xs text-zinc-300">
              {i18n(language, {
                en: "This usually takes 10 to 30 seconds.",
                fr: "Ça prend généralement 10 à 30 secondes.",
              })}
            </p>
          </div>
        )}
      </div>

      <div
        className={cn(
          saasGlassInsetClassName,
          "flex w-full flex-col items-center gap-2 px-5 py-4",
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
          {i18n(language, {
            en: "Your potential score",
            fr: "Ton score potentiel",
          })}
        </p>
        <div className="relative">
          <span
            aria-hidden
            className="select-none font-display text-5xl font-bold tracking-tight text-white blur-md sm:text-6xl"
          >
            {POTENTIAL_SCORE_DISPLAY}
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Lock className="h-6 w-6 text-white/80 sm:h-7 sm:w-7" />
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          {i18n(language, {
            en: "Unlock to see your real score and personalized roadmap.",
            fr: "Débloque pour voir ton vrai score et ta feuille de route personnalisée.",
          })}
        </p>
      </div>

      <button
        type="button"
        onClick={onUnlock}
        disabled={isUnlocking || isLoading}
        className={cn(
          "flex w-full items-center justify-center gap-2 px-4 py-3 text-base transition disabled:pointer-events-none disabled:opacity-60 sm:py-3.5",
          onboardingPrimaryCtaClassName,
        )}
      >
        {isUnlocking ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
        <span className="text-sm font-semibold tracking-tight sm:text-base">
          {i18n(language, {
            en: "Unlock my full analysis",
            fr: "Débloquer mon analyse complète",
          })}
        </span>
      </button>
    </div>
  );
}
