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
 * **dès que le job d'analyse est créé / réutilisé**, pas à la complétion
 * du worker ScanFace. Le rationnel :
 *
 * - Un échec d'analyse (timeout ScanFace, schéma invalide, slot manquant,
 *   crash du process pendant le run, redéploiement Railway, etc.) ne doit
 *   jamais renvoyer l'utilisateur sur la page marketing : il a déjà fait
 *   tout son boulot (capture des 8 photos + clic « Lancer »).
 * - Un refresh navigateur pendant l'analyse ne doit pas non plus le
 *   piéger sur l'écran 0 : la state React locale (`onboardingJobId`,
 *   `stepIndex`) est perdue, mais le flag DB persiste.
 *
 * On ne fait plus de double-check via `useLatestFaceAnalysis` : c'était
 * une défense contre les drifts admin (suppressions manuelles de jobs)
 * mais ça regressait sur le cas réel d'échec d'analyse.
 *
 * Le statut "premium / accès à l'app" reste totalement indépendant : il
 * dépend de `is_subscriber` / `role=admin` côté `useAuth`, pas de ce gate.
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
