import * as React from "react";

import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { DayPlan } from "@/lib/protocol-day";
import { useRoutineDayCompletion } from "@/hooks/use-routine-day-completion";

export interface RoutineDayProgressBarProps {
  language: AppLanguage;
  plan: DayPlan;
  today?: Date;
  userId: string | null;
  /**
   * Variante visuelle. `header` cible le bandeau métal en haut de la page
   * (`ProtocolPageShell` header slot) — texte sombre, contraste élevé.
   * `panel` (par défaut) reste calé pour s'intégrer à une carte blanche.
   */
  variant?: "panel" | "header";
  className?: string;
}

/**
 * Barre « Progression du jour » réutilisable.
 *
 * Extraite de `RoutineDayPanel` pour pouvoir la rendre dans le header de la
 * page (`ProtocolPageShell`) — sous "Mon protocole / <date>" — où elle a plus
 * de sens visuellement qu'au-dessus du carrousel : un seul indicateur de
 * progression, immédiatement visible, sans ré-affichage par slide.
 *
 * Ne rend rien quand la journée n'a aucune étape trackable (équivalent à
 * l'ancienne garde `hasDaily && total > 0 && canTrack`) pour ne pas afficher
 * un widget vide.
 */
export function RoutineDayProgressBar({
  language,
  plan,
  today = new Date(),
  userId,
  variant = "panel",
  className,
}: RoutineDayProgressBarProps) {
  const stepIds = React.useMemo(
    () => [...plan.morning, ...plan.midday, ...plan.evening].map((s) => s.id),
    [plan.morning, plan.midday, plan.evening],
  );

  const { percent, completedCount, total } = useRoutineDayCompletion(
    userId,
    plan.dayOffset,
    stepIds,
    today,
  );

  const hasDaily =
    plan.morning.length > 0 ||
    plan.midday.length > 0 ||
    plan.evening.length > 0;
  const canTrack = Boolean(userId);

  if (!(hasDaily && total > 0 && canTrack)) {
    return null;
  }

  const isHeader = variant === "header";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.12em]",
            isHeader ? "text-zinc-700" : "text-zinc-500",
          )}
        >
          {i18n(language, {
            en: "Day progress",
            fr: "Progression du jour",
          })}
        </span>
        <span
          className={cn(
            "tabular-nums text-sm font-semibold",
            isHeader ? "text-zinc-950" : "text-zinc-900",
          )}
        >
          {percent}%
        </span>
      </div>
      <div
        className={cn(
          "h-2 w-full overflow-hidden rounded-full",
          isHeader ? "bg-zinc-900/15" : "bg-zinc-200",
        )}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={i18n(language, {
          en: `Routine completed: ${completedCount} of ${total}`,
          fr: `Routine : ${completedCount} sur ${total}`,
        })}
      >
        <div
          className="h-full rounded-full bg-zinc-900 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
