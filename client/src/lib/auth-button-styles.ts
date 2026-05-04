import { primaryCtaSurfaceClassName } from "@/lib/cta-button-styles";

/**
 * OAuth — même surface que le CTA hero (border primary + ombre).
 */
export const authOAuthButtonClassName = `${primaryCtaSurfaceClassName} h-11 w-full justify-center text-sm`;

/**
 * Submit — fond blanc, texte foncé, même bordure / élévation que le hero.
 */
export const authPrimarySubmitClassName =
  "h-12 w-full rounded-sm border border-primary-border bg-white text-base font-semibold text-slate-900 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_40px_-8px_rgba(0,0,0,0.45)] hover-elevate active-elevate-2 hover:bg-zinc-50";
