import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Loader2 } from "lucide-react";
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
import { PLAN_DISPLAY, SUBSCRIPTION_PLANS, type Plan } from "@shared/schema";

const billingPanelClassName =
  "relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]";

const PLAN_BENEFITS: Record<Plan, string[]> = {
  monthly: [
    "Analyses illimitées",
    "Recommandations personnalisées",
    "Support prioritaire",
  ],
  yearly: [
    "Analyses illimitées",
    "Recommandations personnalisées",
    "Support prioritaire",
    "2 mois offerts vs mensuel",
  ],
};

const BILLING_QUERY_KEY = ["billing", "subscription"] as const;

export default function Billing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);

  const { data: state, isLoading } = useQuery({
    queryKey: BILLING_QUERY_KEY,
    queryFn: fetchBillingState,
    staleTime: 30_000,
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: Plan) => createBillingCheckout(plan),
    onMutate: (plan) => {
      setPendingPlan(plan);
    },
    onSuccess: ({ checkout_url }) => {
      window.location.href = checkout_url;
    },
    onError: (error) => {
      setPendingPlan(null);
      toast({
        variant: "destructive",
        title: "Paiement impossible",
        description: error instanceof Error ? error.message : "Erreur inconnue",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => createBillingPortalSession(),
    onSuccess: ({ portal_url }) => {
      window.location.href = portal_url;
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Portail indisponible",
        description: error instanceof Error ? error.message : "Erreur inconnue",
      });
      void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEY });
    },
  });

  const isSubscriber = Boolean(state?.is_subscriber);
  const activePlanId = (state?.active_subscription?.granted_reason ??
    null) as Plan | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Facturation
        </h1>
        <p className="text-zinc-300">
          Gérez votre abonnement ScoreMax et débloquez toutes les analyses.
        </p>
      </div>

      {state?.is_admin && (
        <Card className={billingPanelClassName}>
          <CardHeader>
            <CardTitle>Accès administrateur</CardTitle>
            <CardDescription className="text-zinc-300">
              Votre rôle admin vous donne accès à toutes les fonctionnalités premium
              sans abonnement payant.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {SUBSCRIPTION_PLANS.map((planId) => {
          const display = PLAN_DISPLAY[planId];
          const isCurrent = isSubscriber && activePlanId === planId;
          const isLoadingThisPlan =
            checkoutMutation.isPending && pendingPlan === planId;

          return (
            <Card key={planId} className={billingPanelClassName}>
              {planId === "yearly" && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                  Économisez
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {display.label_fr}
                  {isCurrent && (
                    <Badge variant="secondary">Plan actuel</Badge>
                  )}
                </CardTitle>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    {display.price_label_fr}
                  </span>
                  <span className="text-zinc-300">/ {display.cadence_fr}</span>
                </div>
                {display.tagline_fr && (
                  <CardDescription className="mt-2 text-zinc-300">
                    {display.tagline_fr}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3 text-sm">
                  {PLAN_BENEFITS[planId].map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-zinc-100" />
                      <span className="text-zinc-200">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isSubscriber ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                  >
                    {portalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Gérer mon abonnement"
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => checkoutMutation.mutate(planId)}
                    disabled={isLoading || checkoutMutation.isPending}
                  >
                    {isLoadingThisPlan ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Passer à l'offre ${display.label_fr.toLowerCase()}`
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className={billingPanelClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Paiement &amp; factures
          </CardTitle>
          <CardDescription className="text-zinc-300">
            Cartes, factures, annulation : tout se passe sur votre portail
            sécurisé Dodo Payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSubscriber ? (
            <Button
              variant="outline"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Ouvrir le portail Dodo"
              )}
            </Button>
          ) : (
            <p className="text-sm text-zinc-300">
              Souscrivez à une offre pour accéder à votre portail de gestion.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
