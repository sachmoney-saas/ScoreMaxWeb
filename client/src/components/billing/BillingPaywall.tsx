import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  createBillingCheckout,
  fetchBillingState,
} from "@/lib/billing-api";
import { i18n, useAppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  PLAN_DISPLAY,
  SUBSCRIPTION_PLANS,
  type Plan,
} from "@shared/schema";

export const BILLING_QUERY_KEY = ["billing", "subscription"] as const;

const paywallOuterClass =
  "relative mx-auto max-w-5xl overflow-hidden rounded-[1.85rem] border border-white/[0.12] bg-zinc-950/55 p-8 shadow-[0_48px_120px_-72px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-10";

const paywallEmbeddedClass =
  "relative w-full overflow-hidden rounded-2xl border border-white/[0.12] bg-black/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:p-7 md:p-8";

const planCardInnerClass =
  "relative flex h-full flex-col rounded-2xl border border-white/[0.1] bg-black/40 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-6";

const planCardEmbeddedClass =
  "relative flex h-full flex-col rounded-2xl border border-white/[0.12] bg-black/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm sm:p-6 md:p-7";

const PLAN_BENEFITS: Record<
  Plan,
  { fr: readonly string[]; en: readonly string[] }
> = {
  monthly: {
    fr: [
      "1 analyse par semaine",
      "Recommandations personnalisées",
      "Support prioritaire",
    ],
    en: [
      "1 analysis per week",
      "Personalized recommendations",
      "Priority support",
    ],
  },
  yearly: {
    fr: [
      "1 analyse par semaine",
      "Recommandations personnalisées",
      "Support prioritaire",
      "2 mois offerts vs mensuel",
    ],
    en: [
      "1 analysis per week",
      "Personalized recommendations",
      "Priority support",
      "≈2 months free vs monthly",
    ],
  },
};

function planFeatures(plan: Plan, lang: "fr" | "en"): string[] {
  return [...(lang === "fr" ? PLAN_BENEFITS[plan].fr : PLAN_BENEFITS[plan].en)];
}

type Props = {
  /** Intégré dans le panneau glass de l’onboarding (étape finale). */
  variant?: "standalone" | "embedded";
};

export function BillingPaywall({ variant = "standalone" }: Props) {
  const language = useAppLanguage();
  const lang = language === "fr" ? "fr" : "en";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const embedded = variant === "embedded";

  const {
    data: state,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: BILLING_QUERY_KEY,
    queryFn: fetchBillingState,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEY });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [queryClient]);

  const checkoutMutation = useMutation({
    mutationFn: (plan: Plan) => createBillingCheckout(plan),
    onMutate: (plan) => setPendingPlan(plan),
    onSuccess: ({ checkout_url }) => {
      window.location.href = checkout_url;
    },
    onError: (mutationError) => {
      setPendingPlan(null);
      toast({
        variant: "destructive",
        title: i18n(language, { en: "Payment failed", fr: "Paiement impossible" }),
        description:
          mutationError instanceof Error ? mutationError.message : "Erreur inconnue",
      });
    },
  });

  const planDisplayByLang = useMemo(() => {
    return SUBSCRIPTION_PLANS.map((pid) => {
      const d = PLAN_DISPLAY[pid];
      const label =
        lang === "fr"
          ? d.label_fr
          : pid === "monthly"
            ? "Monthly"
            : "Annual";
      const price =
        lang === "fr" ? d.price_label_fr : pid === "monthly" ? "€24.80" : "€178";
      const cadence =
        lang === "fr" ? d.cadence_fr : pid === "monthly" ? "month" : "year";
      const tagline =
        lang === "fr"
          ? d.tagline_fr
          : pid === "yearly"
            ? "Save about 40% vs monthly"
            : undefined;
      return { pid, label, price, cadence, tagline };
    });
  }, [lang]);

  const outerClass = embedded ? paywallEmbeddedClass : paywallOuterClass;

  if (isPending) {
    return (
      <div
        className={cn(
          outerClass,
          "flex min-h-[14rem] flex-col items-center justify-center gap-4 text-zinc-400",
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" aria-hidden />
        <p className="text-sm">
          {i18n(language, {
            en: "Loading plans…",
            fr: "Chargement des offres…",
          })}
        </p>
      </div>
    );
  }

  if (isError || !state) {
    const message = error instanceof Error ? error.message : undefined;
    return (
      <div className={outerClass} role="alert">
        <p className="font-medium text-red-200">
          {i18n(language, {
            en: "Could not load subscription plans.",
            fr: "Impossible de charger les offres.",
          })}
        </p>
        {message ? <p className="mt-2 text-sm text-zinc-400">{message}</p> : null}
      </div>
    );
  }

  if (state.is_subscriber) {
    return null;
  }

  return (
    <div
      className={outerClass}
      role="region"
      aria-label={i18n(language, {
        en: "Subscription plans",
        fr: "Formules d'abonnement",
      })}
    >
      {!embedded ? (
        <>
          <div
            className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#d6e4ff]/12 blur-[100px]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-[90px]"
            aria-hidden
          />
        </>
      ) : null}

      <div className="relative">
        <div
          className={cn(
            "mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] font-semibold uppercase tracking-[0.2em] text-zinc-300",
            embedded
              ? "mb-3 px-3.5 py-1.5 text-[11px]"
              : "px-3 py-1 text-[10px]",
          )}
        >
          ScoreMax Premium
        </div>
        <h2
          className={cn(
            "font-display font-bold tracking-tight text-white",
            embedded ? "text-2xl sm:text-3xl md:text-[1.85rem] md:leading-snug" : "text-3xl sm:text-4xl",
          )}
        >
          {embedded
            ? i18n(language, {
                en: "Unlock your full analysis",
                fr: "Débloque ton analyse complète",
              })
            : i18n(language, { en: "Billing", fr: "Facturation" })}
        </h2>
        <p
          className={cn(
            "leading-relaxed text-zinc-400",
            embedded
              ? "mt-2.5 max-w-3xl text-sm sm:text-[0.9375rem]"
              : "mt-3 max-w-2xl text-base",
          )}
        >
          {i18n(language, {
            en: "Subscribe to unlock every analysis, full recommendations and priority support.",
            fr: "Abonne-toi pour débloquer toutes les analyses, les recommandations complètes et le support prioritaire.",
          })}
        </p>

        <div
          className={cn(
            "grid",
            embedded
              ? "mt-7 grid-cols-1 gap-5 sm:mt-8 sm:grid-cols-2 sm:gap-6 lg:gap-7"
              : "mt-6 gap-6 md:grid-cols-2 md:gap-8",
          )}
        >
          {planDisplayByLang.map(({ pid, label, price, cadence, tagline }) => {
            const isLoadingThisPlan =
              checkoutMutation.isPending && pendingPlan === pid;

            return (
              <div
                key={pid}
                className={cn(
                  embedded ? planCardEmbeddedClass : planCardInnerClass,
                  pid === "yearly" &&
                    (embedded ? "sm:ring-1 sm:ring-white/15" : "md:ring-1 md:ring-white/15"),
                )}
              >
                {pid === "yearly" ? (
                  <div className="absolute right-4 top-4">
                    <span className="rounded-md border border-white/20 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-900">
                      {i18n(language, { en: "Save", fr: "Économisez" })}
                    </span>
                  </div>
                ) : null}

                <div className={pid === "yearly" ? "pr-16" : undefined}>
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {label}
                  </p>
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                    <span className="text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
                      {price}
                    </span>
                    <span className="text-sm text-zinc-400">/ {cadence}</span>
                  </div>
                  {tagline ? (
                    <p className="mt-1.5 text-sm text-zinc-400">{tagline}</p>
                  ) : null}
                </div>

                <ul
                  className={cn(
                    "mt-5 flex flex-1 flex-col text-zinc-200",
                    embedded ? "gap-3 text-[0.9375rem]" : "gap-2.5 text-sm",
                  )}
                >
                  {planFeatures(pid, lang).map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check
                        className={cn(
                          "mt-0.5 shrink-0 text-emerald-300/90",
                          embedded ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4",
                        )}
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  type="button"
                  className={cn(
                    "w-full rounded-xl border border-white/10 bg-white font-semibold text-zinc-950 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] hover:bg-zinc-100",
                    embedded
                      ? "mt-6 h-12 min-h-[3rem] text-[0.9375rem] sm:mt-7"
                      : "mt-5 h-11 text-base",
                  )}
                  size="lg"
                  onClick={() => checkoutMutation.mutate(pid)}
                  disabled={checkoutMutation.isPending}
                >
                  {isLoadingThisPlan ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    i18n(language, {
                      en: `Subscribe — ${label.toLowerCase()}`,
                      fr: `Passer à l'offre ${label.toLowerCase()}`,
                    })
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <p
          className={cn(
            "leading-snug text-zinc-600",
            embedded
              ? "mx-auto mt-6 max-w-3xl text-center text-[0.8125rem] sm:mx-0 sm:text-left"
              : "mt-5 max-w-xl text-xs",
          )}
        >
          {i18n(language, {
            en: "Secure checkout via Dodo Payments. Taxes and invoicing appear in your customer portal.",
            fr: "Paiement sécurisé via Dodo Payments. Taxes et factures sont disponibles dans ton portail client.",
          })}
        </p>
      </div>
    </div>
  );
}

