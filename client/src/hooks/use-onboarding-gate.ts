import { useAuth } from "@/hooks/use-auth";

export type OnboardingGateStatus =
  | "loading"
  | "anon"
  | "needs_onboarding"
  | "ok";

/**
 * Source de vérité unique pour « doit-on afficher l'app ou l'onboarding ? ».
 *
 * Onboardé = `profiles.has_completed_onboarding === true`.
 *
 * Côté serveur (`POST /v1/onboarding/complete`), ce flag est positionné
 * **dès que les photos onboarding sont complètes et que le teaser potentiel
 * est lancé côté backend**. La vraie analyse ScoreMax reste derrière le
 * paywall et démarre après paiement.
 *
 * - Un échec de teaser potentiel (timeout OneShot, crash process, redéploiement
 *   Railway, etc.) ne doit jamais renvoyer l'utilisateur sur la page marketing :
 *   il a déjà fait tout son boulot (capture des 8 photos + clic « Lancer »).
 * - Un refresh navigateur pendant la génération du teaser ne doit pas non plus
 *   le piéger sur l'écran 0 : la state React locale (`stepIndex`) est perdue,
 *   mais le flag DB persiste.
 *
 * On ne fait plus de double-check via `useLatestFaceAnalysis` : c'était
 * une défense contre les drifts admin (suppressions manuelles de jobs)
 * mais ça regressait sur le cas réel d'échec d'analyse.
 *
 * L’accès aux routes `/app/*` (et assimilées) est **en plus** conditionné par
 * `hasPremiumAccess` dans `App.tsx` (`ProtectedRoute`) : onboarding terminé
 * mais non abonné → redirection vers `/billing` (paywall), pas d’intérieur app.
 */
export function useOnboardingGate(): { status: OnboardingGateStatus } {
  const { user, profile, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return { status: "loading" };
  }

  if (!user) {
    return { status: "anon" };
  }

  if (!profile) {
    /**
     * Le profil n'a pas encore été chargé (network slow / retry en cours).
     * On évite de renvoyer l'utilisateur déjà onboardé vers /onboarding
     * sur un faux négatif transitoire.
     */
    return { status: "loading" };
  }

  if (!profile.has_completed_onboarding) {
    return { status: "needs_onboarding" };
  }

  return { status: "ok" };
}
