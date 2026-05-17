import * as React from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { saasGlassInsetClassName } from "@/lib/auth-page-shell-styles";
import { onboardingPrimaryCtaClassName } from "@/lib/cta-button-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { OnboardingPotentialImage } from "@/hooks/use-onboarding-potential-image";
import { OnboardingMultistepGlassLoader } from "@/components/onboarding/OnboardingMultistepGlassLoader";
import { BeforeAfterSlider, beforeAfterMediaFrameClassName } from "@/components/onboarding/BeforeAfterSlider";

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
          "mx-auto flex w-full min-w-[10.5rem] max-w-[min(15rem,88vw)] items-center justify-center gap-2 rounded-sm px-6 py-[clamp(0.55rem,1.4vh,0.875rem)] transition disabled:pointer-events-none disabled:opacity-60",
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
  /** Côté « actuel » : photo source du scan (identique à l’entrée OneShot), sans masque filaire. */
  const beforeSrc =
    potentialImage?.source_face_signed_url ??
    potentialImage?.mask_overlay_signed_url ??
    null;

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
            saasGlassInsetClassName,
            "pointer-events-none w-full max-w-none shrink-0 select-none rounded-2xl p-[clamp(0.75rem,1.8vh,1.25rem)] text-left",
          )}
          aria-hidden
        >
          <div className="h-4 w-40 animate-pulse rounded bg-white/12 sm:h-5 sm:w-48" />
          <div className="mt-3 space-y-2.5">
            <div className="h-3 w-full animate-pulse rounded bg-white/10 sm:h-3.5" />
            <div className="h-3 w-full animate-pulse rounded bg-white/10 sm:h-3.5" />
            <div className="h-3 w-full animate-pulse rounded bg-white/10 sm:h-3.5" />
            <div className="h-3 w-[88%] animate-pulse rounded bg-white/10 sm:h-3.5" />
          </div>
        </div>
        <div
          className="h-[clamp(2.25rem,5.5vh,3rem)] w-full shrink-0 animate-pulse rounded-sm bg-white/10"
          aria-hidden
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
          afterSrc={afterSrc}
          className="mx-auto"
        />
      </motion.div>
      <div
        className={cn(
          saasGlassInsetClassName,
          "w-full max-w-none shrink-0 rounded-2xl p-[clamp(0.75rem,1.8vh,1.25rem)] text-left",
        )}
      >
        <h3 className="text-[clamp(0.85rem,1.7vh,1rem)] font-semibold text-white">
          {i18n(language, {
            en: "What this means",
            fr: "Ce que ça signifie",
          })}
        </h3>
        <p className="mt-[clamp(0.3rem,0.8vh,0.5rem)] w-full max-w-none text-[clamp(0.78rem,1.5vh,0.9375rem)] leading-relaxed text-zinc-400">
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
