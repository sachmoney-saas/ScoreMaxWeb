import * as React from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  Heart,
  ScanFace,
  Smartphone,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingScanStatus } from "@/hooks/use-supabase";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { AUTH_CONFIG } from "@/config/auth";

type OnboardingStep = {
  title: string;
  category: string;
  claim: string;
  source: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const steps: OnboardingStep[] = [
  {
    title: "Ton apparence influence directement tes revenus",
    category: "Finances",
    claim: "Les personnes attirantes gagnent 10-15% de plus.",
    source:
      "Hamermesh, D. S., and J. E. Biddle. (1994). The American Economic Review.",
    description:
      "Le beauty privilege se traduit concrètement dans la rémunération et les opportunités de carrière.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Les entretiens sont aussi influencés par l'apparence",
    category: "Finances",
    claim: "Les candidats attirants sont perçus comme plus qualifiés.",
    source:
      "Puleo, R. (2006). Journal of Undergraduate Psychological Research.",
    description:
      "La première impression visuelle impacte l'évaluation avant même l'analyse en profondeur.",
    icon: Users,
  },
  {
    title: "L'apparence agit même sur les performances commerciales",
    category: "Finances",
    claim:
      "Les serveurs attirants reçoivent $1261 de pourboires en plus par an. Les clients ont 55% plus de chances d'acheter à des vendeurs attirants.",
    source:
      "Parrett, M. (2015). Journal of Economic Psychology. Reingen, P. H., and Kernan, J. B. (1993). Journal of Consumer Psychology.",
    description:
      "Dans les interactions transactionnelles, l'effet halo augmente la confiance et le passage à l'action.",
    icon: ArrowRight,
  },
  {
    title: "En rencontres, le visuel domine la première décision",
    category: "Rencontres",
    claim:
      "Sur les apps de rencontre, l'apparence compte environ 9 fois plus que la bio.",
    source:
      "Witmer, J., Rosenbusch, H., and Meral, E. O. (2025). Computers in Human Behavior Reports.",
    description:
      "Ton image est le filtre principal d'entrée: optimiser ta présentation change la qualité des opportunités.",
    icon: Heart,
  },
  {
    title: "L'effet halo transforme aussi ta vie sociale",
    category: "Vie sociale",
    claim:
      "Les personnes attirantes sont perçues comme plus morales et plus dignes de confiance.",
    source:
      "Shinners, E. (2009). UW-L Journal of Undergraduate Research; Klebl et al. (2022). Journal of Nonverbal Behavior.",
    description:
      "Confiance, crédibilité, leadership: l'apparence influence ces perceptions dans de nombreux contextes.",
    icon: Users,
  },
  {
    title: "Teste-toi et découvre ton potentiel",
    category: "ScoreMax",
    claim:
      "ScoreMax analyse ton visage pour te donner un diagnostic clair et actionnable.",
    source: "Analyse IA ScoreMax",
    description:
      "Tu identifies précisément tes points forts et tes axes d'amélioration pour un glow-up mesurable.",
    icon: ScanFace,
  },
  {
    title: "Télécharge ensuite l'app iPhone",
    category: "App Store",
    claim: "Retrouve ton suivi et ta progression directement sur mobile.",
    source: "App Store ScoreMax (à la sortie officielle)",
    description:
      "Tu pourras consulter tes analyses et ton évolution à tout moment depuis l'application iOS.",
    icon: Smartphone,
  },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user, profile } = useAuth();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
      setLocation(AUTH_CONFIG.LOGIN_PATH);
      return;
    }

    if (profile?.has_completed_onboarding) {
      setLocation(AUTH_CONFIG.REDIRECT_PATH);
    }
  }, [profile?.has_completed_onboarding, setLocation, user]);

  const markOnboardingCompleted = React.useCallback(async () => {
    if (!user?.id || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ has_completed_onboarding: true })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      setLocation(AUTH_CONFIG.REDIRECT_PATH);
    } catch (error) {
      console.error("Unable to complete onboarding:", error);
      setIsSubmitting(false);
    }
  }, [isSubmitting, setLocation, user?.id]);

  const handleNext = React.useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      markOnboardingCompleted();
      return;
    }

    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [markOnboardingCompleted, stepIndex]);

  const currentStep = steps[stepIndex];
  const CurrentIcon = currentStep.icon;
  const isLastStep = stepIndex === steps.length - 1;

  const {
    data: scanStatus,
    isLoading: isScanStatusLoading,
    isError: isScanStatusError,
  } = useOnboardingScanStatus({ enabled: isLastStep && !!user?.id });

  const requiredAssetCount = scanStatus?.required_asset_count ?? 8;
  const completedAssetCount = scanStatus?.completed_asset_count ?? 0;
  const missingAssetTypes = scanStatus?.missing_asset_types ?? [];
  const isScanReady = scanStatus?.is_ready ?? false;
  const canCompleteOnboarding = !isLastStep || isScanReady;

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[linear-gradient(135deg,#c9d9df_0%,#9fb7bf_48%,#6f8d95_100%)]">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col justify-center px-4 py-8 sm:px-6">
        <div className="space-y-6">
          <div className="flex justify-center">
            <img
              src="/favicon.png"
              alt="Logo ScoreMax"
              className="h-10 w-10 rounded-xl border border-white/50 bg-white/80 p-1.5 shadow-[0_10px_28px_-18px_rgba(9,20,37,0.65)]"
            />
          </div>

          <div className="grid grid-cols-8 gap-1.5">
            {steps.map((_, index) => (
              <div
                key={`step-segment-${index}`}
                className={`h-2 rounded-full transition-colors duration-200 ${
                  index <= stepIndex ? "bg-[#121826]" : "bg-white/50"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.article
              key={`onboarding-step-${stepIndex}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-8 rounded-[2rem] border border-white/60 bg-white p-6 shadow-[0_24px_70px_-35px_rgba(9,20,37,0.55)] sm:p-10"
            >
              <div className="space-y-5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                  <CurrentIcon className="h-6 w-6" />
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {currentStep.category}
                  </p>
                  <h1 className="text-2xl font-display font-bold leading-tight tracking-tight text-slate-900 sm:text-[2rem]">
                    {currentStep.title}
                  </h1>
                  <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                    {currentStep.description}
                  </p>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                    {currentStep.claim}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">
                    {currentStep.source}
                  </p>
                </div>

                {isLastStep ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        Statut du scan
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {completedAssetCount}/{requiredAssetCount}
                      </p>
                    </div>

                    {isScanStatusLoading ? (
                      <p className="text-sm text-slate-600">
                        Vérification des photos en cours...
                      </p>
                    ) : null}

                    {isScanStatusError ? (
                      <p className="text-sm text-red-600">
                        Impossible de vérifier les photos pour l'instant.
                        Réessaie dans quelques secondes.
                      </p>
                    ) : null}

                    {!isScanStatusLoading && !isScanStatusError ? (
                      isScanReady ? (
                        <p className="text-sm font-semibold text-emerald-700">
                          Scan complet: toutes les photos obligatoires sont
                          prêtes.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-slate-700">
                            Photos manquantes:
                          </p>
                          <ul className="space-y-1 pl-4 text-sm text-slate-600">
                            {missingAssetTypes.map((assetType) => (
                              <li key={assetType} className="list-disc">
                                {assetType}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={stepIndex === 0 || isSubmitting}
                  className="rounded-xl bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  Retour
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting || !canCompleteOnboarding}
                  className="rounded-xl bg-black text-white hover:bg-zinc-800"
                >
                  {isLastStep ? "Terminer" : "Continuer"}
                </Button>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
