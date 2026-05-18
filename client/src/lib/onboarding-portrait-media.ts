import { cn } from "@/lib/utils";

/** Classe Tailwind : cadre strict 3:4 (largeur / hauteur). */
export const onboardingPortraitAspectClassName = "aspect-[3/4]" as const;

/**
 * Remplit le cadre 3:4 sans déformation (recadrage centré, léger bias vers le haut pour les portraits).
 */
export const onboardingPortraitImageClassName =
  "absolute inset-0 h-full w-full object-cover object-[center_20%]";

const portraitFrameShellClassName =
  "relative w-full h-auto overflow-visible rounded-xl border border-white/15 bg-black/25 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.7)]";

/**
 * Cadre avant/après onboarding : ratio 3:4 fixe, taille fluide selon la largeur dispo.
 * Les `max-h` en vh évitent le débordement vertical tout en conservant le ratio quand possible.
 */
export const beforeAfterMediaFrameClassName = cn(
  portraitFrameShellClassName,
  onboardingPortraitAspectClassName,
  "max-w-[min(100%,21rem)] max-h-[min(28vh,15.5rem)] sm:max-h-[min(32vh,17.5rem)] sm:max-w-[min(100%,23rem)] md:max-h-[min(36vh,19.5rem)] md:max-w-[min(100%,26rem)] lg:max-h-[min(40vh,23rem)] lg:max-w-[min(100%,30rem)] xl:max-h-[min(44vh,26rem)] xl:max-w-[min(100%,34rem)]",
);

/** Cadre portrait compact (landing, placeholders). */
export const onboardingPortraitFrameCompactClassName = cn(
  portraitFrameShellClassName,
  onboardingPortraitAspectClassName,
  "min-h-0 overflow-hidden",
);
