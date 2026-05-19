import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Sparkles } from "lucide-react";
import { BillingPaywall } from "@/components/billing/BillingPaywall";
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
  BILLING_QUERY_KEY,
  BILLING_QUERY_STALE_TIME_MS,
  createBillingPortalSession,
  fetchBillingState,
} from "@/lib/billing-api";
import { i18n, useAppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PLAN_DISPLAY, type Plan } from "@shared/schema";

const billingPanelClassName =
  "relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]";

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

  const {
    data: state,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: BILLING_QUERY_KEY,
    queryFn: fetchBillingState,
    staleTime: BILLING_QUERY_STALE_TIME_MS,
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

  if (isPending) {
    return (
      <div className="flex min-h-[22rem] flex-col items-center justify-center gap-4 text-zinc-400">
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
    const message = error instanceof Error ? error.message : undefined;
    return (
      <div role="alert">
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

  if (!isAdmin && !isSubscriber) {
    return <BillingPaywall variant="standalone" />;
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
