import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Zap } from "lucide-react";

const billingPanelClassName = "relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]";

export default function Billing() {
  const { profile } = useAuth();

  const plans = [
    {
      name: "Gratuit",
      price: "0 €",
      description: "Parfait pour explorer la plateforme.",
      features: ["Jusqu'à 3 projets", "Analyses de base", "Support communautaire"],
      current: !profile?.is_subscriber,
      recommended: false,
    },
    {
      name: "Pro",
      price: "29 €",
      description: "Pour les constructeurs sérieux et les petites équipes.",
      features: ["Projets illimités", "Analyses avancées", "Support prioritaire", "Domaines personnalisés"],
      current: !!profile?.is_subscriber,
      recommended: true,
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Facturation</h1>
        <p className="text-zinc-300">Gérez votre abonnement et vos paiements.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.name} className={billingPanelClassName}>
            {plan.recommended && (
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                Recommandé
              </div>
            )}
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {plan.name}
                {plan.current && <Badge variant="secondary">Plan Actuel</Badge>}
              </CardTitle>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-zinc-300">/mois</span>
              </div>
              <CardDescription className="mt-2 text-zinc-300">{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-zinc-100" />
                    <span className="text-zinc-200">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full" 
                variant={plan.current ? "outline" : "default"}
                disabled={plan.current}
              >
                {plan.current ? "Gérer l'abonnement" : `Passer à l'offre ${plan.name}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className={billingPanelClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Mode de Paiement
          </CardTitle>
          <CardDescription className="text-zinc-300">Mettez à jour vos coordonnées bancaires.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-300">Aucun mode de paiement enregistré.</p>
        </CardContent>
      </Card>
    </div>
  );
}
