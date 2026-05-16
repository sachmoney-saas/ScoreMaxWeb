/**
 * Modèle d'accès produit (source de vérité côté client).
 *
 * - `needs_onboarding_capture` : scan onboarding non terminé
 * - `onboarding_paywall_funnel` : scan OK, jamais abonné → parcours /onboarding
 * - `lapsed_subscriber` : ex-abonné → /app en lecture seule + /billing pour réabonner
 * - `premium` : abonné actif ou admin
 */

export type UserAccessKind =
  | "loading"
  | "anonymous"
  | "needs_onboarding_capture"
  | "onboarding_paywall_funnel"
  | "lapsed_subscriber"
  | "premium";

export type UserAccessSnapshot = {
  kind: UserAccessKind;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Routes /app/* (dashboard, historique, détails). */
  canAccessApp: boolean;
  /** Lancement d'une nouvelle analyse manuelle. */
  canLaunchNewAnalyses: boolean;
  /** Parcours capture + teaser + paywall initial. */
  shouldUseOnboardingFlow: boolean;
  /** Chemin après login (utilisateurs authentifiés). */
  postLoginPath: "/app" | "/onboarding";
};

export type UserAccessInput = {
  isLoading: boolean;
  userId: string | null | undefined;
  hasCompletedOnboarding: boolean;
  hasEverSubscribed: boolean;
  hasPremiumAccess: boolean;
  isAdmin: boolean;
};

export function resolveUserAccess(input: UserAccessInput): UserAccessSnapshot {
  if (input.isLoading) {
    return {
      kind: "loading",
      isLoading: true,
      isAuthenticated: false,
      canAccessApp: false,
      canLaunchNewAnalyses: false,
      shouldUseOnboardingFlow: false,
      postLoginPath: "/onboarding",
    };
  }

  if (!input.userId) {
    return {
      kind: "anonymous",
      isLoading: false,
      isAuthenticated: false,
      canAccessApp: false,
      canLaunchNewAnalyses: false,
      shouldUseOnboardingFlow: false,
      postLoginPath: "/onboarding",
    };
  }

  if (input.hasPremiumAccess || input.isAdmin) {
    return {
      kind: "premium",
      isLoading: false,
      isAuthenticated: true,
      canAccessApp: true,
      canLaunchNewAnalyses: true,
      shouldUseOnboardingFlow: false,
      postLoginPath: "/app",
    };
  }

  if (!input.hasCompletedOnboarding) {
    return {
      kind: "needs_onboarding_capture",
      isLoading: false,
      isAuthenticated: true,
      canAccessApp: false,
      canLaunchNewAnalyses: false,
      shouldUseOnboardingFlow: true,
      postLoginPath: "/onboarding",
    };
  }

  if (input.hasEverSubscribed) {
    return {
      kind: "lapsed_subscriber",
      isLoading: false,
      isAuthenticated: true,
      canAccessApp: true,
      canLaunchNewAnalyses: false,
      shouldUseOnboardingFlow: false,
      postLoginPath: "/app",
    };
  }

  return {
    kind: "onboarding_paywall_funnel",
    isLoading: false,
    isAuthenticated: true,
    canAccessApp: false,
    canLaunchNewAnalyses: false,
    shouldUseOnboardingFlow: true,
    postLoginPath: "/onboarding",
  };
}
