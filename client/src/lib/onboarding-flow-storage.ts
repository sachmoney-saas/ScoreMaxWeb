const STORAGE_KEY = "sm_onb_flow";

export type OnboardingFlowStorage = {
  /** 0 = capture, 1 = teaser potentiel, 2 = paywall (fin onboarding) */
  step: number;
};

export function readOnboardingFlowState(): OnboardingFlowStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "step" in parsed &&
      typeof (parsed as OnboardingFlowStorage).step === "number"
    ) {
    return parsed as OnboardingFlowStorage;
  }
  return null;
  } catch {
    return null;
  }
}

export function writeOnboardingFlowState(state: OnboardingFlowStorage): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearOnboardingFlowState(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

/** Autorise l’affichage de /onboarding même si `has_completed_onboarding` est déjà true (étape potentiel). */
export function isOnboardingPotentialTeaserActive(): boolean {
  const s = readOnboardingFlowState();
  return s !== null && s.step >= 1;
}

export function isOnboardingBillingStepActive(): boolean {
  const s = readOnboardingFlowState();
  return s !== null && s.step >= 2;
}

/** Étape initiale pour un utilisateur déjà onboardé sans abonnement. */
export function resolveOnboardingInitialStepForReturningUser(options: {
  persistedStep: number | null;
  hasPotentialImage: boolean;
}): number {
  const persisted = options.persistedStep ?? 0;
  if (persisted >= 2) return 2;
  if (persisted >= 1) return 1;
  if (options.hasPotentialImage) return 1;
  return 2;
}
