import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { i18n, useAppLanguage } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AUTH_CONFIG } from "@/config/auth";

const innerClassName =
  "relative mx-auto max-w-lg overflow-hidden rounded-[1.85rem] border border-white/[0.12] bg-zinc-950/55 p-8 shadow-[0_48px_120px_-72px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-10";

const BILLING_QUERY_KEY = ["billing", "subscription"] as const;

export default function BillingSuccess() {
  const language = useAppLanguage();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEY });
  }, [queryClient, user?.id]);

  return (
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
  );
}
