import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  createBillingCheckout,
  createBillingPortalSession,
  fetchBillingState,
} from "@/lib/billing-api";
import { i18n, useAppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  PLAN_DISPLAY,
  SUBSCRIPTION_PLANS,
  type Plan,
} from "@shared/schema";

const billingPanelClassName =
  "relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]";

const paywallOuterClass =
  "relative mx-auto max-w-5xl overflow-hidden rounded-[1.85rem] border border-white/[0.12] bg-zinc-950/55 p-8 shadow-[0_48px_120px_-72px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-10";

const planCardInnerClass =
  "relative flex h-full flex-col rounded-2xl border border-white/[0.1] bg-black/40 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm";

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

const BILLING_QUERY_KEY = ["billing", "subscription"] as const;

function planFeatures(plan: Plan, lang: "fr" | "en"): string[] {
  return [...(lang === "fr" ? PLAN_BENEFITS[plan].fr : PLAN_BENEFITS[plan].en)];
}

function formatPeriodEnd(iso: string, lang: "fr" | "en"): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "long",
  }).format(date);
}

function subscriberPlanSummary(
  plan: Plan,
  lang: "fr" | "en",
): { label: string; priceLine: string } {
  const d = PLAN_DISPLAY[plan];
  if (lang === "fr") {
    return {
      label: d.label_fr,
      priceLine: `${d.price_label_fr} / ${d.cadence_fr}`,
    };
  }
  return plan === "monthly"
    ? { label: "Monthly", priceLine: "€24.80 / month" }
    : { label: "Annual", priceLine: "€178 / year" };
}

export default function Billing() {
  const language = useAppLanguage();
  const lang = language === "fr" ? "fr" : "en";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);

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

  const portalMutation = useMutation({
    mutationFn: () => createBillingPortalSession(),
    onSuccess: ({ portal_url }) => {
      window.location.href = portal_url;
    },
    onError: (mutationError) => {
      toast({
        variant: "destructive",
        title: i18n(language, { en: "Portal unavailable", fr: "Portail indisponible" }),
        description:
          mutationError instanceof Error ? mutationError.message : "Erreur inconnue",
      });
      void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEY });
    },
  });

  const isSubscriber = Boolean(state?.is_subscriber);
  const isAdmin = Boolean(state?.is_admin);
  const activeSubscription = state?.active_subscription ?? null;
  const subscriberPlan: Plan | null = activeSubscription?.plan ?? null;
  const scheduledCancellation = Boolean(
    activeSubscription?.scheduled_cancellation,
  );
  const periodEndIso = activeSubscription?.current_period_end ?? null;

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

  if (isPending) {
    return (
      <div
        className={cn(
          paywallOuterClass,
          "flex min-h-[22rem] flex-col items-center justify-center gap-4 text-zinc-400",
        )}
      >
        <Loader2 className="h-10 w-10 animate-spin text-zinc-500" aria-hidden />
        <p className="text-sm">
          {i18n(language, {
            en: "Loading billing…",
            fr: "Chargement de la facturation…",
          })}
        </p>
      </div>
    );
  }

  if (isError || !state) {
    const message =
      error instanceof Error ? error.message : undefined;
    return (
      <div className={cn(paywallOuterClass)} role="alert">
        <p className="font-medium text-red-200">
          {i18n(language, {
            en: "Could not load billing state.",
            fr: "Impossible de charger la facturation.",
          })}
        </p>
        {message ? (
          <p className="mt-2 text-sm text-zinc-400">{message}</p>
        ) : null}
      </div>
    );
  }

  if (isAdmin && !isSubscriber) {
    return (
      <Card className={billingPanelClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-amber-200/90" aria-hidden />
            {i18n(language, {
              en: "Administrator access",
              fr: "Accès administrateur",
            })}
          </CardTitle>
          <CardDescription className="text-zinc-300">
            {i18n(language, {
              en: "Your admin role unlocks all premium features without a paid subscription.",
              fr: "Votre rôle admin vous donne accès à toutes les fonctionnalités premium sans abonnement payant.",
            })}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const showPaywall = !isAdmin && !isSubscriber;

  if (showPaywall) {
    return (
      <div
        className={paywallOuterClass}
        role="region"
        aria-label={i18n(language, {
          en: "Subscription plans",
          fr: "Formules d'abonnement",
        })}
      >
        <div
          className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#d6e4ff]/12 blur-[100px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-[90px]"
          aria-hidden
        />

        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
            ScoreMax Premium
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {i18n(language, { en: "Billing", fr: "Facturation" })}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-400">
            {i18n(language, {
              en: "Subscribe to unlock every analysis worker, full recommendations and priority support.",
              fr: "Abonnez-vous pour débloquer toutes les analyses, les recommandations complètes et le support prioritaire.",
            })}
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2 md:gap-8">
            {planDisplayByLang.map(({ pid, label, price, cadence, tagline }) => {
              const isLoadingThisPlan =
                checkoutMutation.isPending && pendingPlan === pid;

              return (
                <div
                  key={pid}
                  className={cn(
                    planCardInnerClass,
                    pid === "yearly" && "md:ring-1 md:ring-white/15",
                  )}
                >
                  {pid === "yearly" ? (
                    <div className="absolute right-4 top-4">
                      <span className="rounded-md border border-white/20 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-900">
                        {i18n(language, { en: "Save", fr: "Économisez" })}
                      </span>
                    </div>
                  ) : null}

                  <div className="pr-16">
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      {label}
                    </p>
                    <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                      <span className="text-4xl font-bold tabular-nums tracking-tight text-white sm:text-[2.75rem]">
                        {price}
                      </span>
                      <span className="text-base text-zinc-400">/ {cadence}</span>
                    </div>
                    {tagline ? (
                      <p className="mt-2 text-sm text-zinc-400">{tagline}</p>
                    ) : null}
                  </div>

                  <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm">
                    {planFeatures(pid, lang).map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-zinc-200">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/90"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    type="button"
                    className="mt-8 h-11 w-full rounded-xl border border-white/10 bg-white text-base font-semibold text-zinc-950 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] hover:bg-zinc-100"
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

          <p className="mt-8 max-w-xl text-xs leading-snug text-zinc-600">
            {i18n(language, {
              en: "Secure checkout via Dodo Payments. Taxes and invoicing appear in your customer portal.",
              fr: "Paiement sécurisé via Dodo Payments. Taxes et factures sont disponibles dans votre portail client.",
            })}
          </p>
        </div>
      </div>
    );
  }

  const subscribedPlanSummary =
    subscriberPlan !== null ? subscriberPlanSummary(subscriberPlan, lang) : null;

  return (
    <div className="space-y-8">
      {isAdmin ? (
        <Card className={billingPanelClassName}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-amber-200/90" aria-hidden />
              {i18n(language, {
                en: "Administrator access",
                fr: "Accès administrateur",
              })}
            </CardTitle>
            <CardDescription className="text-zinc-300">
              {i18n(language, {
                en: "Your subscription is listed below; admin role does not waive billing history.",
                fr: "Votre abonnement payant figure ci‑dessous ; le rôle admin n’efface pas l’historique de facturation.",
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          {i18n(language, { en: "Billing", fr: "Facturation" })}
        </h1>
        <p className="mt-2 text-zinc-400">
          {i18n(language, {
            en: "Manage your subscription and payment methods.",
            fr: "Gérez votre abonnement et vos moyens de paiement.",
          })}
        </p>
      </div>

      <Card className={billingPanelClassName}>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3 text-white">
            <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
            {i18n(language, {
              en: "Subscription & invoices",
              fr: "Abonnement & factures",
            })}
            <Badge
              variant="secondary"
              className={cn(
                "font-medium",
                scheduledCancellation &&
                  "border-amber-400/35 bg-amber-500/15 text-amber-100",
              )}
            >
              {scheduledCancellation
                ? i18n(language, {
                    en: "Scheduled cancellation",
                    fr: "Annulation programmée",
                  })
                : i18n(language, { en: "Active", fr: "Actif" })}
            </Badge>
          </CardTitle>
          <CardDescription className="text-zinc-300">
            {subscribedPlanSummary ? (
              <>
                <span className="font-medium text-zinc-200">
                  {subscribedPlanSummary.label}
                </span>
                <span className="mt-1 block text-sm text-zinc-400 tabular-nums">
                  {subscribedPlanSummary.priceLine}
                </span>
              </>
            ) : (
              i18n(language, {
                en: "You have an active subscription.",
                fr: "Vous avez un abonnement actif.",
              })
            )}
            {scheduledCancellation ? (
              <span className="mt-3 block text-sm text-amber-100/90">
                {periodEndIso
                  ? i18n(language, {
                      en: `Premium access remains until ${formatPeriodEnd(periodEndIso, lang)}. No charge after that date.`,
                      fr: `L'accès premium reste actif jusqu'au ${formatPeriodEnd(periodEndIso, lang)}. Aucun prélèvement après cette date.`,
                    })
                  : i18n(language, {
                      en: "Premium access remains until the end of your current billing period.",
                      fr: "L'accès premium reste actif jusqu'à la fin de votre période de facturation en cours.",
                    })}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            className="rounded-xl sm:min-w-[12rem]"
            variant="outline"
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
          >
            {portalMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              i18n(language, {
                en: "Open Dodo portal",
                fr: "Ouvrir le portail Dodo",
              })
            )}
          </Button>
          <p className="self-center text-xs text-zinc-500 sm:flex-1 sm:min-w-[16rem]">
            {i18n(language, {
              en: "Update card, download invoices or cancel inside Dodo.",
              fr: "Modifiez la carte, téléchargez les factures ou résiliez depuis Dodo.",
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
