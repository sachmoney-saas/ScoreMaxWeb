import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  BILLING_QUERY_KEY,
  BILLING_QUERY_STALE_TIME_MS,
  createBillingCheckout,
  fetchBillingState,
} from "@/lib/billing-api";
import { i18n, useAppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  hardmaxxingGradientPillClassName,
  softmaxxingGradientPillClassName,
} from "@/components/analysis/recommendations/recommendation-type-styles";
import {
  PLAN_DISPLAY,
  SUBSCRIPTION_PLANS,
  type Plan,
} from "@shared/schema";

export { BILLING_QUERY_KEY };

const paywallOuterClass =
  "relative mx-auto max-w-5xl overflow-hidden rounded-[1.85rem] border border-white/[0.12] bg-zinc-950/55 p-8 shadow-[0_48px_120px_-72px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-10";

const paywallEmbeddedClass =
  "relative w-full overflow-hidden rounded-2xl border border-white/[0.12] bg-black/30 p-[clamp(0.85rem,2.2vh,2rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md";

const planCardInnerClass =
  "relative flex h-full flex-col rounded-2xl border border-white/[0.1] bg-black/40 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-6";

const planCardEmbeddedClass =
  "relative flex h-full flex-col rounded-2xl border border-white/[0.12] bg-black/45 p-[clamp(0.75rem,2vh,1.75rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm";

type PlanBenefit = {
  fr: string;
  en: string;
  accent?: "soft" | "hard";
};

const PRIMARY_PLAN_BENEFITS: Record<Plan, PlanBenefit> = {
  monthly: {
    fr: "Une analyse faciale chaque semaine pour suivre ton évolution",
    en: "A facial analysis every week to track your progress",
  },
  yearly: {
    fr: "Une analyse faciale chaque semaine pour suivre ton évolution",
    en: "A facial analysis every week to track your progress",
  },
};

const SHARED_PLAN_BENEFITS: readonly PlanBenefit[] = [
  {
    fr: "Protocole sur mesure ajusté à chaque analyse",
    en: "Personalized protocol adjusted after each analysis",
  },
  {
    fr: "Recommandations personnalisées",
    en: "Personalized recommendations",
  },
  {
    fr: "Recommandations SoftMaxxing",
    en: "SoftMaxxing recommendations",
    accent: "soft",
  },
  {
    fr: "Recommandations HardMaxxing",
    en: "HardMaxxing recommendations",
    accent: "hard",
  },
  {
    fr: "Support prioritaire",
    en: "Priority support",
  },
];

const YEARLY_EXTRA_BENEFITS: readonly PlanBenefit[] = [
  {
    fr: "2 mois offerts vs mensuel",
    en: "≈2 months free vs monthly",
  },
];

function planFeatures(plan: Plan): PlanBenefit[] {
  return [
    PRIMARY_PLAN_BENEFITS[plan],
    ...SHARED_PLAN_BENEFITS,
    ...(plan === "yearly" ? YEARLY_EXTRA_BENEFITS : []),
  ];
}

function PlanBenefitText({
  feature,
  lang,
}: {
  feature: PlanBenefit;
  lang: "fr" | "en";
}) {
  const label = lang === "fr" ? feature.fr : feature.en;
  if (!feature.accent) return <span>{label}</span>;

  const term = feature.accent === "soft" ? "SoftMaxxing" : "HardMaxxing";
  const [before, after] = label.split(term);
  const pillClass =
    feature.accent === "soft"
      ? softmaxxingGradientPillClassName
      : hardmaxxingGradientPillClassName;

  return (
    <span className="min-w-0">
      {before}
      <span
        className={cn(
          pillClass,
          "mx-1 inline-flex rounded-lg px-2 py-0.5 text-[0.68em] leading-none align-middle",
        )}
      >
        <span className="relative z-10">{term}</span>
      </span>
      {after}
    </span>
  );
}

type Props = {
  /** `standalone` = page ; `embedded` = panneau interne avec cadre glass ; `dialog` = même contenu que embedded, sans double cadre (pour `DialogContent`). */
  variant?: "standalone" | "embedded" | "dialog";
};

export function BillingPaywall({ variant = "standalone" }: Props) {
  const language = useAppLanguage();
  const lang = language === "fr" ? "fr" : "en";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("monthly");
  const isDialog = variant === "dialog";
  /** Grille / typo « compacte », avec ou sans cadre glass externe. */
  const useEmbeddedLayout = variant === "embedded" || isDialog;

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

  const outerClass = isDialog
    ? "relative w-full"
    : useEmbeddedLayout
      ? paywallEmbeddedClass
      : paywallOuterClass;

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

  const activePlanRow = planDisplayByLang.find((p) => p.pid === selectedPlan);
  if (!activePlanRow) {
    return null;
  }
  const { pid, label, price, cadence, tagline } = activePlanRow;
  const isLoadingActivePlan = checkoutMutation.isPending && pendingPlan === pid;

  return (
    <div
      className={outerClass}
      role="region"
      aria-label={i18n(language, {
        en: "Subscription plans",
        fr: "Formules d'abonnement",
      })}
    >
      {variant === "standalone" ? (
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

      <div
        className={cn(
          "relative",
          useEmbeddedLayout && "text-center",
        )}
      >
        <h2
          className={cn(
            "font-display font-bold tracking-tight text-white",
            useEmbeddedLayout
              ? // En mode dialog/embedded : titre fluide en `vh` pour que tout
                // (titre → bouton Select) tienne dans la viewport sans scroll.
                "text-[clamp(1.2rem,3vh,1.85rem)] leading-tight"
              : "text-3xl sm:text-4xl",
          )}
        >
          {useEmbeddedLayout
            ? i18n(language, {
                en: "Start your Glow Up",
                fr: "Commences ton Glow Up",
              })
            : i18n(language, { en: "Billing", fr: "Facturation" })}
        </h2>
        <p
          className={cn(
            "leading-relaxed text-zinc-400",
            useEmbeddedLayout
              ? "mx-auto mt-[clamp(0.25rem,0.7vh,0.625rem)] max-w-3xl text-[clamp(0.78rem,1.6vh,0.9375rem)]"
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
            "mx-auto flex justify-center",
            useEmbeddedLayout
              ? "mt-[clamp(0.65rem,1.7vh,1.5rem)] max-w-lg"
              : "mt-6 max-w-md",
          )}
          role="tablist"
          aria-label={i18n(language, {
            en: "Billing period",
            fr: "Période de facturation",
          })}
        >
          <div className="flex w-full rounded-2xl border border-white/10 bg-black/35 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {(["monthly", "yearly"] as const).map((pid) => {
              const isActive = selectedPlan === pid;
              const tabLabel =
                pid === "monthly"
                  ? i18n(language, { en: "Monthly", fr: "Mensuel" })
                  : i18n(language, { en: "Annual", fr: "Annuel" });
              return (
                <button
                  key={pid}
                  type="button"
                  role="tab"
                  id={`billing-tab-${pid}`}
                  aria-selected={isActive}
                  aria-controls="billing-plan-panel"
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors",
                    useEmbeddedLayout
                      ? "py-[clamp(0.4rem,1.1vh,0.75rem)]"
                      : "min-h-[2.75rem]",
                    isActive
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                  onClick={() => setSelectedPlan(pid)}
                >
                  {tabLabel}
                  {pid === "yearly" ? (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        isActive
                          ? "bg-emerald-600/15 text-emerald-800"
                          : "border border-white/15 bg-white/[0.06] text-emerald-300/90",
                      )}
                    >
                      {i18n(language, { en: "Save", fr: "Éco" })}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="billing-plan-panel"
          role="tabpanel"
          aria-labelledby={`billing-tab-${pid}`}
          className={cn(
            "mx-auto text-left",
            useEmbeddedLayout
              ? "mt-[clamp(0.6rem,1.6vh,1.5rem)] max-w-lg"
              : "mt-5 max-w-md",
          )}
        >
          <div
            className={cn(
              useEmbeddedLayout ? planCardEmbeddedClass : planCardInnerClass,
              pid === "yearly" && "ring-1 ring-white/15",
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
              <p
                className={cn(
                  "font-semibold uppercase tracking-[0.12em] text-zinc-500",
                  useEmbeddedLayout
                    ? "text-[clamp(0.7rem,1.4vh,0.875rem)]"
                    : "text-sm",
                )}
              >
                {label}
              </p>
              <div
                className={cn(
                  "flex flex-wrap items-baseline gap-x-1.5 gap-y-1",
                  useEmbeddedLayout
                    ? "mt-[clamp(0.4rem,1vh,0.75rem)]"
                    : "mt-3",
                )}
              >
                <span
                  className={cn(
                    "font-bold tabular-nums tracking-tight text-white",
                    useEmbeddedLayout
                      ? "text-[clamp(1.5rem,3.4vh,2.25rem)]"
                      : "text-3xl sm:text-4xl",
                  )}
                >
                  {price}
                </span>
                <span className="text-sm text-zinc-400">/ {cadence}</span>
              </div>
              {tagline ? (
                <p
                  className={cn(
                    "text-zinc-400",
                    useEmbeddedLayout
                      ? "mt-[clamp(0.2rem,0.6vh,0.4rem)] text-[clamp(0.75rem,1.4vh,0.875rem)]"
                      : "mt-1.5 text-sm",
                  )}
                >
                  {tagline}
                </p>
              ) : null}
            </div>

            <ul
              className={cn(
                "flex flex-col text-zinc-200",
                useEmbeddedLayout
                  ? "mt-[clamp(0.6rem,1.4vh,1.25rem)] gap-[clamp(0.3rem,0.9vh,0.75rem)] text-[clamp(0.78rem,1.5vh,0.9375rem)]"
                  : "mt-5 gap-2.5 text-sm",
              )}
            >
              {planFeatures(pid).map((feature) => {
                const label = lang === "fr" ? feature.fr : feature.en;
                return (
                  <li
                    key={`${feature.accent ?? "default"}-${label}`}
                    className="flex gap-2.5"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 shrink-0 text-emerald-300/90",
                        useEmbeddedLayout
                          ? "h-[1.125rem] w-[1.125rem]"
                          : "h-4 w-4",
                      )}
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    <PlanBenefitText feature={feature} lang={lang} />
                  </li>
                );
              })}
            </ul>
          </div>

          <Button
            type="button"
            className={cn(
              "w-full rounded-xl border border-white/10 bg-white font-semibold text-zinc-950 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] hover:bg-zinc-100",
              useEmbeddedLayout
                ? // `min-h` retiré : la hauteur réagit au `vh` (rentre toujours
                  // dans la viewport, jamais coupé en bas du dialog).
                  "mt-[clamp(0.6rem,1.4vh,1.25rem)] h-[clamp(2.4rem,5.5vh,3rem)] text-[clamp(0.85rem,1.7vh,0.9375rem)]"
                : "mt-4 h-11 text-base",
            )}
            size="lg"
            onClick={() => checkoutMutation.mutate(pid)}
            disabled={checkoutMutation.isPending}
            aria-label={i18n(language, {
              en: `Select ${label} plan`,
              fr: `Choisir l'offre ${label}`,
            })}
          >
            {isLoadingActivePlan ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              i18n(language, {
                en: "Select",
                fr: "Choisir",
              })
            )}
          </Button>
        </div>

        <p
          className={cn(
            "leading-snug text-zinc-600",
            useEmbeddedLayout
              ? "mx-auto mt-[clamp(0.5rem,1.2vh,1.25rem)] max-w-3xl text-center text-[clamp(0.7rem,1.3vh,0.8125rem)]"
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
