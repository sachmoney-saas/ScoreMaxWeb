import * as React from "react";
import { Hourglass } from "lucide-react";

import { i18n, type AppLanguage } from "@/lib/i18n";
import type { ProtocolCure } from "@/lib/protocol";
import { ProtocolItemCard } from "@/components/protocol/ProtocolItemCard";
import { ProtocolSection } from "@/components/protocol/ProtocolSection";

/* ============================================================================
 * ProtocolActiveCures — time-bounded interventions with progress
 *
 * A "cure" is any saved recommendation that has no recurring slot but does
 * have a duration_value. We compute elapsed/remaining from the moment the
 * user added it to their protocol.
 * ========================================================================= */

function CureProgressBar({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400/70 to-emerald-200/80"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CureTrailing({
  cure,
  language,
}: {
  cure: ProtocolCure;
  language: AppLanguage;
}) {
  if (cure.totalDays === null) {
    return (
      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-300">
        {i18n(language, { en: "Ongoing", fr: "En cours" })}
      </span>
    );
  }

  const remaining = Math.max(0, cure.totalDays - cure.elapsedDays);
  const isDone = cure.progress !== null && cure.progress >= 1;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset ${
        isDone
          ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/25"
          : "bg-white/[0.06] text-zinc-300 ring-white/10"
      }`}
    >
      {isDone
        ? i18n(language, { en: "Completed", fr: "Terminée" })
        : i18n(language, {
            en: `${remaining}d left`,
            fr: `${remaining} j restant${remaining > 1 ? "s" : ""}`,
          })}
    </span>
  );
}

export interface ProtocolActiveCuresProps {
  cures: ProtocolCure[];
  language: AppLanguage;
}

export function ProtocolActiveCures({
  cures,
  language,
}: ProtocolActiveCuresProps) {
  if (cures.length === 0) return null;

  return (
    <ProtocolSection
      eyebrow={i18n(language, { en: "In progress", fr: "En cours" })}
      title={i18n(language, {
        en: "Active cures",
        fr: "Cures actives",
      })}
      description={i18n(language, {
        en: "Time-bounded interventions you've started — surgeries, injectable cycles, sessions and the like.",
        fr: "Interventions à durée définie que tu as commencées — chirurgies, cycles d'injectables, séances, etc.",
      })}
      icon={Hourglass}
      count={cures.length}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cures.map((cure) => (
          <div key={cure.action.id} className="space-y-2">
            <ProtocolItemCard
              item={cure}
              language={language}
              trailing={<CureTrailing cure={cure} language={language} />}
            />
            {cure.progress !== null ? (
              <div className="px-1">
                <CureProgressBar progress={cure.progress} />
                <p className="mt-1 text-[10px] text-zinc-500 tabular-nums">
                  {i18n(language, {
                    en: `${cure.elapsedDays} / ${cure.totalDays} days`,
                    fr: `${cure.elapsedDays} / ${cure.totalDays} jours`,
                  })}
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ProtocolSection>
  );
}
