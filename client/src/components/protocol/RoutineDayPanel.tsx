import * as React from "react";

import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { DayPlan, RoutineSlot } from "@/lib/protocol-day";
import { dayOffsetToDate } from "@/lib/protocol-day";
import { RoutineStepRow } from "@/components/protocol/RoutineStepRow";
import { useRoutineDayCompletion } from "@/hooks/use-routine-day-completion";

const SLOT_LABELS: Record<RoutineSlot, { en: string; fr: string }> = {
  morning: { en: "Morning", fr: "Matin" },
  midday: { en: "Midday", fr: "Midi" },
  evening: { en: "Evening", fr: "Soir" },
};

const SLOTS: RoutineSlot[] = ["morning", "midday", "evening"];

function formatDayHeader(
  language: AppLanguage,
  dayOffset: number,
  today: Date,
): string {
  const date = dayOffsetToDate(dayOffset, today);
  const weekday = new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
    weekday: "long",
  }).format(date);
  const rest = new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
  }).format(date);

  if (dayOffset === 0) {
    return i18n(language, {
      en: `Today · ${weekday} ${rest}`,
      fr: `Aujourd'hui · ${weekday} ${rest}`,
    });
  }

  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized} ${rest}`;
}

function AgendaColumn({
  language,
  slot,
  steps,
  checkedIds,
  onToggleStep,
  interactive,
}: {
  language: AppLanguage;
  slot: RoutineSlot;
  steps: DayPlan["morning"];
  checkedIds: ReadonlySet<string>;
  onToggleStep: (id: string) => void;
  interactive: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-col",
        "border-b border-zinc-200 last:border-b-0",
      )}
    >
      <div className="shrink-0 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {i18n(language, SLOT_LABELS[slot])}
        </h3>
      </div>
      <div className="flex-1 p-3">
        {steps.length === 0 ? (
          <p className="text-xs text-zinc-400">—</p>
        ) : (
          <ol className="space-y-2.5">
            {steps.map((step, idx) => (
              <RoutineStepRow
                key={step.id}
                index={idx + 1}
                title={step.title}
                detail={step.detail}
                variant="light"
                checked={checkedIds.has(step.id)}
                onCheckedChange={
                  interactive ? () => onToggleStep(step.id) : undefined
                }
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export interface RoutineDayPanelProps {
  language: AppLanguage;
  plan: DayPlan;
  today?: Date;
  userId: string | null;
}

export function RoutineDayPanel({
  language,
  plan,
  today = new Date(),
  userId,
}: RoutineDayPanelProps) {
  const stepsBySlot: Record<RoutineSlot, DayPlan["morning"]> = {
    morning: plan.morning,
    midday: plan.midday,
    evening: plan.evening,
  };

  const stepIds = React.useMemo(
    () => [...plan.morning, ...plan.midday, ...plan.evening].map((s) => s.id),
    [plan.morning, plan.midday, plan.evening],
  );

  const canTrack = Boolean(userId);

  const { checkedIds, toggle } = useRoutineDayCompletion(
    userId,
    plan.dayOffset,
    stepIds,
    today,
  );

  const hasDaily =
    plan.morning.length > 0 ||
    plan.midday.length > 0 ||
    plan.evening.length > 0;

  return (
    <article className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-zinc-100 px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight text-zinc-900">
          {formatDayHeader(language, plan.dayOffset, today)}
        </h2>
      </header>

      {!hasDaily ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">
          {i18n(language, {
            en: "No steps for this day.",
            fr: "Aucune étape pour ce jour.",
          })}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {SLOTS.map((slot) => (
            <AgendaColumn
              key={slot}
              language={language}
              slot={slot}
              steps={stepsBySlot[slot]}
              checkedIds={checkedIds}
              onToggleStep={toggle}
              interactive={canTrack}
            />
          ))}
        </div>
      )}
    </article>
  );
}

