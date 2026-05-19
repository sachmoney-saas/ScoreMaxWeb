import { ONBOARDING_POTENTIAL_MAX_WAIT_MS } from "@shared/onboarding-potential";

/**
 * Délais post-capture avant l’écran mesh « Ton scan est terminé ».
 * La génération OneShot (Nano Banana / nano-banana) doit être prête ou en échec / timeout.
 */
export const ONBOARDING_POST_CAPTURE_GEOMETRY_MIN_MS = 2800;

/** Garde-fou : ne pas bloquer indéfiniment si l’API image ne répond pas. */
export const ONBOARDING_POST_CAPTURE_POTENTIAL_MAX_WAIT_MS =
  ONBOARDING_POTENTIAL_MAX_WAIT_MS;

export type OnboardingPotentialImagePrelude = {
  status: "pending" | "completed" | "failed";
  signed_url: string | null;
};

/**
 * Après le splash « scan terminé » : sauter le loader multi-étapes si l’aperçu potentiel
 * est déjà résolu (ex. reconnexion + cache React Query) ou en échec définitif
 * (rien à attendre côté génération).
 */
export function shouldSkipOnboardingGeometryPrelude(
  image: OnboardingPotentialImagePrelude | null | undefined,
): boolean {
  if (!image) return false;
  if (image.status === "failed") return true;
  return image.status === "completed" && Boolean(image.signed_url);
}
