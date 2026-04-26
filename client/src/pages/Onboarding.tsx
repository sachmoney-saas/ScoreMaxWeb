import * as React from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  Globe2,
  Heart,
  ScanFace,
  Smartphone,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
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
    title: "Compare-toi aux différentes zones du monde",
    category: "Classement mondial",
    claim:
      "Si tu le souhaites, tu peux situer ton score par zone géographique.",
    source: "Comparaisons ScoreMax",
    description:
      "France, Europe, Amérique, Asie: visualise ton positionnement selon les standards locaux.",
    icon: Globe2,
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

  return (
    <div className="hero-bg-grain relative min-h-[100svh] overflow-hidden bg-[#020202]">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-xl flex-col justify-center px-4 py-8 sm:px-6">
        <div className="space-y-8">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-[#d6e4ff]"
            >
              ScoreMax
            </Link>
            <p className="text-xs font-medium text-zinc-400">
              Étape {stepIndex + 1} / {steps.length}
            </p>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              key={`step-progress-${stepIndex}`}
              initial={{ width: 0 }}
              animate={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-[#d6e4ff] via-white to-[#e8f0ff]"
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.article
              key={`onboarding-step-${stepIndex}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-8"
            >
              <div className="space-y-5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-[#d6e4ff]">
                  <CurrentIcon className="h-6 w-6" />
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    {currentStep.category}
                  </p>
                  <h1 className="text-2xl font-display font-bold leading-tight tracking-tight text-zinc-50 sm:text-[2rem]">
                    {currentStep.title}
                  </h1>
                  <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
                    {currentStep.description}
                  </p>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-sm font-semibold leading-relaxed text-[#f2f6ff] sm:text-base">
                    {currentStep.claim}
                  </p>
                  <p className="text-xs leading-relaxed text-zinc-300 sm:text-sm">
                    {currentStep.source}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={stepIndex === 0 || isSubmitting}
                  className="rounded-xl border border-white/20 bg-white/5 text-zinc-200 hover:bg-white/15 disabled:opacity-40"
                >
                  Retour
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="rounded-xl bg-white text-black hover:bg-zinc-200"
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
