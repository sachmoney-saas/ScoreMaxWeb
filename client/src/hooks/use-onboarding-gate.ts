import { useAuth } from "@/hooks/use-auth";
import { useLatestFaceAnalysis } from "@/hooks/use-supabase";

export type OnboardingGateStatus =
  | "loading"
  | "anon"
  | "needs_onboarding"
  | "ok";

/**
 * Single source of truth for “should the user see the app shell or onboarding?”.
 *
 * Onboardé = `has_completed_onboarding` ET au moins **un job d’analyse**
 * existant pour ce user (peu importe son statut courant). On accepte
 * `queued` / `running` / `completed` : ils prouvent qu’une session a déjà été
 * créée + lancée, donc l’onboarding (capture des assets) est forcément passé.
 *
 * Ne PAS renvoyer `needs_onboarding` quand un job est en cours, sinon dès
 * qu’un user lance une nouvelle analyse depuis `/app/new-analysis` la query
 * `latest-face-analysis` est invalidée, retourne un job `queued`, et le gate
 * redirige l’utilisateur (déjà onboardé) vers `/onboarding` — boucle confuse.
 *
 * - Pas de profil ou flag à `false` → onboarding.
 * - Flag à `true` mais **aucun** job persisté (API renvoie `null`) → onboarding
 *   (admin drift, jobs supprimés manuellement).
 * - Détermination en cours: `loading`.
 */
export function useOnboardingGate(): { status: OnboardingGateStatus } {
  const { user, profile, isLoading: authLoading } = useAuth();
  const onboardingFlag = profile?.has_completed_onboarding ?? false;

  const latestEnabled = Boolean(user?.id && onboardingFlag);
  const latestQuery = useLatestFaceAnalysis({
    enabled: latestEnabled,
  });

  if (authLoading) {
    return { status: "loading" };
  }

  if (!user) {
    return { status: "anon" };
  }

  if (!profile || !onboardingFlag) {
    return { status: "needs_onboarding" };
  }

  if (latestQuery.isLoading) {
    return { status: "loading" };
  }

  /**
   * Ne pas faire échouer le gate sur une erreur réseau transitoire : si
   * `has_completed_onboarding` est à `true`, on fait confiance au flag plutôt
   * que de renvoyer un user déjà onboardé vers `/onboarding`.
   */
  if (latestQuery.isError) {
    return { status: "ok" };
  }

  const latest = latestQuery.data;
  if (!latest) {
    return { status: "needs_onboarding" };
  }

  const jobStatus = latest.job.status;
  const isPostOnboardingState =
    jobStatus === "completed" ||
    jobStatus === "queued" ||
    jobStatus === "running";

  if (!isPostOnboardingState) {
    return { status: "needs_onboarding" };
  }

  return { status: "ok" };
}
