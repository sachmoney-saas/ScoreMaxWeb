import * as React from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { saasGlassInsetClassName } from "@/lib/auth-page-shell-styles";
import { onboardingPrimaryCtaClassName } from "@/lib/cta-button-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { OnboardingPotentialImage } from "@/hooks/use-onboarding-potential-image";
import { OnboardingMultistepGlassLoader } from "@/components/onboarding/OnboardingMultistepGlassLoader";
import { BeforeAfterSlider } from "@/components/onboarding/BeforeAfterSlider";

type Props = {
  language: AppLanguage;
  potentialImage: OnboardingPotentialImage | null | undefined;
  isLoading: boolean;
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

type DecodedImageState = "idle" | "loading" | "ready" | "error";

function useDecodedImage(src: string | null): DecodedImageState {
  const [state, setState] = React.useState<DecodedImageState>(
    src ? "loading" : "idle",
  );

  React.useEffect(() => {
    if (!src) {
      setState("idle");
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";

    const markReady = () => {
      const maybeDecode = typeof img.decode === "function" ? img.decode() : null;
      void Promise.resolve(maybeDecode)
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) {
            setState("ready");
          }
        });
    };

    setState("loading");
    img.onload = markReady;
    img.onerror = () => {
      if (!cancelled) {
        setState("error");
      }
    };
    img.src = src;

    if (img.complete && img.naturalWidth > 0) {
      markReady();
    }

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return state;
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
      className="flex w-full flex-col items-stretch pt-1 sm:pt-2"
      role="region"
      aria-label={i18n(language, {
        en: "Unlock full analysis",
        fr: "Débloquer l'analyse complète",
      })}
    >
      <button
        type="button"
        onClick={() => void onUnlock()}
        disabled={isUnlocking}
        className={cn(
          "flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-sm px-4 py-3 text-base transition disabled:pointer-events-none disabled:opacity-60 sm:min-h-[3rem] sm:px-5 sm:py-3.5",
          onboardingPrimaryCtaClassName,
        )}
      >
        {isUnlocking ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
        ) : null}
        <span className="text-center text-sm font-semibold tracking-tight sm:text-base">
          {i18n(language, {
            en: "Unlock my full analysis",
            fr: "Débloquer mon analyse complète",
          })}
        </span>
      </button>
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
  onUnlock,
  isUnlocking,
}: Props) {
  const signedUrl = potentialImage?.signed_url ?? null;
  const beforeSrc = potentialImage?.source_face_signed_url ?? null;

  const status = potentialImage?.status ?? "pending";
  const isReady = status === "completed" && !!signedUrl;
  const isFailed = status === "failed";
  const afterSrc = isReady && signedUrl ? signedUrl : null;
  const leftDecoded = useDecodedImage(beforeSrc);
  const rightDecoded = useDecodedImage(afterSrc);

  const showBlockingLoader =
    !isFailed &&
    (isLoading ||
      !isReady ||
      (!!beforeSrc && leftDecoded !== "ready" && leftDecoded !== "error") ||
      (!!afterSrc && rightDecoded !== "ready" && rightDecoded !== "error"));

  if (showBlockingLoader) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 py-4 text-center sm:gap-6 sm:py-6"
      >
        <header className="space-y-2 px-2">
          <Sparkles className="mx-auto h-7 w-7 text-sky-400/90" aria-hidden />
          <h2 className="font-hero text-[1.35rem] font-semibold leading-[1.06] tracking-[-0.015em] text-white sm:text-[1.65rem]">
            {i18n(language, {
              en: "Preparing your preview",
              fr: "Préparation de ton aperçu",
            })}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            {i18n(language, {
              en: "We're building your potential from your scan. This takes a few seconds.",
              fr: "On construit ton potentiel à partir de ton scan. Quelques secondes.",
            })}
          </p>
        </header>
        <OnboardingMultistepGlassLoader
          language={language}
          steps={POTENTIAL_MULTISTEP_STEPS}
          cycleResetKey="potential"
          variant="featured"
          className="w-full"
        />
      </motion.div>
    );
  }

  if (isFailed) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-2 py-2 sm:gap-5">
        <div
          className={cn(
            saasGlassInsetClassName,
            "relative isolate flex aspect-[4/5] w-full max-w-sm flex-col items-center justify-center overflow-hidden p-6 text-center",
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
        <UnlockFullAnalysisCta
          language={language}
          onUnlock={onUnlock}
          isUnlocking={isUnlocking}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-full flex-col items-stretch gap-3 px-0 py-1 sm:gap-4 sm:py-2">
      <header className="w-full text-center">
        <h2
          className={cn(
            "font-hero mx-auto max-w-[min(100%,22ch)] font-semibold tracking-[-0.02em] text-balance text-white",
            "text-[clamp(1.45rem,0.42rem+3.8vw,2.35rem)] leading-[1.1]",
            "sm:max-w-[min(100%,28ch)] sm:leading-[1.08]",
            "md:max-w-[min(100%,32ch)] md:text-[clamp(1.65rem,0.65rem+2.4vw,2.4rem)]",
            "[@media(max-height:700px)]:text-[clamp(1.2rem,0.25rem+3vw,1.9rem)]",
            "lg:leading-[1.06]",
          )}
        >
          {i18n(language, {
            en: "Your Transformation Preview",
            fr: "Ton aperçu transformation",
          })}
        </h2>
        <p className="mt-1.5 text-[0.8125rem] leading-snug text-zinc-300 sm:mt-2 sm:text-sm">
          {i18n(language, {
            en: "See how ScoreMax can help you reach your potential.",
            fr: "Découvre comment ScoreMax peut t'aider à atteindre ton potentiel.",
          })}
        </p>
      </header>
      <motion.div
        className="w-full shrink-0 self-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <BeforeAfterSlider
          language={language}
          beforeSrc={beforeSrc}
          afterSrc={afterSrc}
          className="mx-auto"
        />
      </motion.div>
      <div
        className={cn(
          saasGlassInsetClassName,
          "w-full max-w-none rounded-2xl p-4 text-left sm:p-5",
        )}
      >
        <h3 className="text-sm font-semibold text-white sm:text-base">
          {i18n(language, {
            en: "What this means",
            fr: "Ce que ça signifie",
          })}
        </h3>
        <p className="mt-2 w-full max-w-none text-sm leading-relaxed text-zinc-400 sm:text-[0.9375rem]">
          {i18n(language, {
            en: "Follow your personalized ScoreMax protocol for 12 weeks to reach your next potential tier. We'll track your progress and adjust recommendations until you reach your ultimate objective.",
            fr: "Suis ton protocole ScoreMax personnalisé pendant 12 semaines pour passer au palier de potentiel suivant. On suit tes progrès et on ajuste les recommandations jusqu'à ce que tu atteignes ton objectif ultime.",
          })}
        </p>
      </div>
      <UnlockFullAnalysisCta
        language={language}
        onUnlock={onUnlock}
        isUnlocking={isUnlocking}
      />
    </div>
  );
}
