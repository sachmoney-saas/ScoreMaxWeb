import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { i18n, useAppLanguage } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AUTH_CONFIG } from "@/config/auth";
import {
  kickPostPaymentAnalysis,
  type PostPaymentLaunchOutcome,
} from "@/lib/post-payment-auto-analysis";

const innerClassName =
  "relative mx-auto max-w-lg overflow-hidden rounded-[1.85rem] border border-white/[0.12] bg-zinc-950/55 p-8 shadow-[0_48px_120px_-72px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-10";

const BILLING_QUERY_KEY = ["billing", "subscription"] as const;

type AutoAnalysisState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "outcome"; outcome: PostPaymentLaunchOutcome };

export default function BillingSuccess() {
  const language = useAppLanguage();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [autoState, setAutoState] = React.useState<AutoAnalysisState>({
    kind: "idle",
  });
  const launchAttemptedRef = React.useRef(false);

  React.useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEY });
  }, [queryClient, user?.id]);

  React.useEffect(() => {
    if (!user?.id) return;
    if (launchAttemptedRef.current) return;
    launchAttemptedRef.current = true;

    setAutoState({ kind: "running" });
    void (async () => {
      const outcome = await kickPostPaymentAnalysis({
        userId: user.id,
        language,
      });
      setAutoState({ kind: "outcome", outcome });
      if (outcome.status === "launched" || outcome.status === "already_running") {
        void queryClient.invalidateQueries({
          queryKey: ["analysis-history", user.id],
        });
      }
    })();
  }, [language, queryClient, user?.id]);

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-2 py-8 md:py-10">
      <div className={innerClassName}>
        <div className="flex flex-col items-center gap-6 text-center text-zinc-50">
          <CheckCircle2
            className="h-14 w-14 text-emerald-400"
            aria-hidden
            strokeWidth={1.75}
          />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {i18n(language, {
                fr: "Paiement confirmé",
                en: "Payment confirmed",
              })}
            </h1>
            <p className="text-sm leading-relaxed text-zinc-300">
              {i18n(language, {
                fr: "Merci. Votre abonnement est en cours d’activation. Si l’accès premium n’apparaît pas tout de suite, attendez quelques secondes puis actualisez la page.",
                en: "Thank you. Your subscription is activating. If premium access is not visible yet, wait a few seconds and refresh the page.",
              })}
            </p>
          </div>

          <AutoAnalysisBanner state={autoState} language={language} />

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="w-full rounded-xl bg-zinc-50 text-zinc-950 hover:bg-white sm:w-auto"
            >
              <Link href={AUTH_CONFIG.REDIRECT_PATH}>
                {i18n(language, { fr: "Continuer", en: "Continue" })}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl border-white/20 bg-transparent text-zinc-50 hover:bg-white/10 sm:w-auto"
            >
              <Link href="/billing">
                {i18n(language, {
                  fr: "Facturation",
                  en: "Billing",
                })}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const bannerBaseClass =
  "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm";

function AutoAnalysisBanner({
  state,
  language,
}: {
  state: AutoAnalysisState;
  language: ReturnType<typeof useAppLanguage>;
}) {
  if (state.kind === "idle" || state.kind === "running") {
    return (
      <div
        className={`${bannerBaseClass} border-white/10 bg-white/[0.04] text-zinc-200`}
        role="status"
        aria-live="polite"
      >
        <Loader2
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-zinc-300"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="font-medium text-zinc-100">
            {i18n(language, {
              fr: "Lancement de ton analyse complète…",
              en: "Launching your full analysis…",
            })}
          </p>
          <p className="text-xs leading-relaxed text-zinc-400">
            {i18n(language, {
              fr: "On reprend les photos de ton scan d’onboarding. Elle apparaîtra dans la barre latérale dès qu’elle est dans la file.",
              en: "We’re reusing the photos from your onboarding scan. It will appear in the sidebar as soon as it is queued.",
            })}
          </p>
        </div>
      </div>
    );
  }

  const { outcome } = state;

  if (outcome.status === "launched") {
    return (
      <div
        className={`${bannerBaseClass} border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-100`}
        role="status"
      >
        <Sparkles
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="font-medium">
            {i18n(language, {
              fr: "Analyse complète lancée",
              en: "Full analysis launched",
            })}
          </p>
          <p className="text-xs leading-relaxed text-emerald-100/80">
            {i18n(language, {
              fr: "Suis sa progression dans la barre latérale. Tu peux fermer cette page.",
              en: "Follow its progress in the sidebar. You can close this page.",
            })}
          </p>
        </div>
      </div>
    );
  }

  if (outcome.status === "already_running") {
    return null;
  }

  if (outcome.status === "skipped_already_kicked") {
    return (
      <div
        className={`${bannerBaseClass} border-white/10 bg-white/[0.04] text-zinc-200`}
        role="status"
      >
        <Sparkles
          className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="font-medium text-zinc-100">
            {i18n(language, {
              fr: "Analyse déjà déclenchée",
              en: "Analysis already triggered",
            })}
          </p>
          <p className="text-xs leading-relaxed text-zinc-400">
            {i18n(language, {
              fr: "On l’a lancée juste après ton paiement. Elle apparaît dans la barre latérale.",
              en: "We started it right after your payment. You will see it in the sidebar.",
            })}
          </p>
        </div>
      </div>
    );
  }

  if (outcome.status === "skipped_no_session") {
    return (
      <div
        className={`${bannerBaseClass} border-amber-400/30 bg-amber-500/[0.08] text-amber-100`}
        role="alert"
      >
        <Sparkles
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="font-medium">
            {i18n(language, {
              fr: "Aucun scan d’onboarding détecté",
              en: "No onboarding scan detected",
            })}
          </p>
          <p className="text-xs leading-relaxed text-amber-100/80">
            {i18n(language, {
              fr: "Tu peux relancer une analyse depuis « Nouvelle analyse » dans l’application.",
              en: "You can launch an analysis from the “New analysis” page inside the app.",
            })}
          </p>
        </div>
      </div>
    );
  }

  if (outcome.status === "premium_not_ready") {
    return (
      <div
        className={`${bannerBaseClass} border-amber-400/30 bg-amber-500/[0.08] text-amber-100`}
        role="alert"
      >
        <Loader2
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-300"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="font-medium">
            {i18n(language, {
              fr: "Abonnement encore en cours d’activation",
              en: "Subscription still activating",
            })}
          </p>
          <p className="text-xs leading-relaxed text-amber-100/80">
            {i18n(language, {
              fr: "On lancera l’analyse complète automatiquement dès qu’elle est active. Tu peux actualiser cette page.",
              en: "We’ll launch the full analysis automatically as soon as it is active. You can refresh this page.",
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${bannerBaseClass} border-red-400/30 bg-red-500/[0.08] text-red-100`}
      role="alert"
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">
          {i18n(language, {
            fr: "Impossible de lancer ton analyse automatiquement",
            en: "Could not launch your analysis automatically",
          })}
        </p>
        <p className="text-xs leading-relaxed text-red-100/80">
          {outcome.message ||
            i18n(language, {
              fr: "Tu peux la relancer depuis « Nouvelle analyse » dans l’application.",
              en: "You can launch it from the “New analysis” page inside the app.",
            })}
        </p>
      </div>
    </div>
  );
}
