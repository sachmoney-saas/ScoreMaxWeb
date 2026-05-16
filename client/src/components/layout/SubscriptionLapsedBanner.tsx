import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { i18n, useAppLanguage } from "@/lib/i18n";
import { onboardingPrimaryCtaClassName } from "@/lib/cta-button-styles";

type Props = {
  className?: string;
};

/**
 * Bandeau pour les ex-abonnés : historique visible, nouvelles analyses bloquées.
 */
export function SubscriptionLapsedBanner({ className }: Props) {
  const language = useAppLanguage();

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-amber-50 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-200/90 sm:mt-0" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-amber-50">
            {i18n(language, {
              en: "Your subscription has ended",
              fr: "Ton abonnement est terminé",
            })}
          </p>
          <p className="text-xs leading-relaxed text-amber-100/85 sm:text-sm">
            {i18n(language, {
              en: "You can still browse your past analyses. Resubscribe to launch new ones.",
              fr: "Tu peux toujours consulter tes anciennes analyses. Réabonne-toi pour en lancer de nouvelles.",
            })}
          </p>
        </div>
      </div>
      <Link
        href="/billing"
        className={cn(
          "shrink-0 rounded-lg px-4 py-2 text-center text-sm font-semibold transition",
          onboardingPrimaryCtaClassName,
        )}
      >
        {i18n(language, {
          en: "Resubscribe",
          fr: "Se réabonner",
        })}
      </Link>
    </div>
  );
}
