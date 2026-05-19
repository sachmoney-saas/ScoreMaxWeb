import { cn } from "@/lib/utils";

/** Classe Tailwind : cadre strict 1:1 (carré). */
export const onboardingPortraitAspectClassName = "aspect-square" as const;

/**
 * Remplit le cadre 1:1 sans déformation — cadrage centré (axe horizontal + vertical)
 * pour que les deux vues avant / après restent superposables au slider.
 */
export const onboardingPortraitImageClassName =
  "absolute inset-0 h-full w-full object-cover object-center";

const portraitFrameShellClassName =
  "relative w-full h-auto overflow-visible rounded-xl border border-white/15 bg-black/25 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.7)]";

/**
 * Cadre avant/après onboarding : carré 1:1, borné par largeur et hauteur viewport
 * (les deux contraintes gardent un carré lisible sur mobile sans pousser le CTA).
 */
export const beforeAfterMediaFrameClassName = cn(
  portraitFrameShellClassName,
  onboardingPortraitAspectClassName,
  "mx-auto w-full",
  "max-w-[clamp(13.5rem,min(78vw,calc(100svh-24rem)),18.75rem)] max-h-[clamp(13.5rem,min(78vw,calc(100svh-24rem)),18.75rem)]",
  "sm:max-w-[min(100%,22rem)] sm:max-h-[min(68svh,24rem)] md:max-w-[min(100%,24rem)] md:max-h-[min(72svh,26rem)] lg:max-w-[min(100%,26rem)] lg:max-h-[min(74svh,28rem)] xl:max-w-[min(100%,28rem)] xl:max-h-[min(76svh,30rem)]",
);

/** Cadre portrait compact (landing, placeholders). */
export const onboardingPortraitFrameCompactClassName = cn(
  portraitFrameShellClassName,
  onboardingPortraitAspectClassName,
  "min-h-0 overflow-hidden",
);
