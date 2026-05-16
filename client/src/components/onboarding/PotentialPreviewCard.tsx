import * as React from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { saasGlassInsetClassName } from "@/lib/auth-page-shell-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { OnboardingPotentialImage } from "@/hooks/use-onboarding-potential-image";
import { OnboardingMultistepGlassLoader } from "@/components/onboarding/OnboardingMultistepGlassLoader";
import { BeforeAfterSlider } from "@/components/onboarding/BeforeAfterSlider";

type Props = {
  language: AppLanguage;
  potentialImage: OnboardingPotentialImage | null | undefined;
  isLoading: boolean;
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

/**
 * Affichage post-scan : avant / après avec slider superposé.
 */
export function PotentialPreviewCard({
  language,
  potentialImage,
  isLoading,
}: Props) {
  const signedUrl = potentialImage?.signed_url ?? null;
  const beforeSrc = potentialImage?.mask_overlay_signed_url ?? null;

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
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-2 py-2 sm:py-4">
      <motion.div
        className="w-full self-center"
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
      <p className="mt-3 text-center text-xs text-zinc-400 sm:text-sm">
        {i18n(language, {
          en: "Drag the slider to compare your current look with your potential.",
          fr: "Fais glisser le curseur pour comparer ton look actuel et ton potentiel.",
        })}
      </p>
    </div>
  );
}
