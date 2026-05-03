import * as React from "react";
import { CalendarRange } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { analysisSurfaceCardClassName } from "@/components/analysis/workers/_shared";
import { type AppLanguage, i18n } from "@/lib/i18n";

export function ProtocolHeaderStats({
  language,
  total,
  dailyCount,
  weeklyCount,
  cureCount,
  ruleCount,
}: {
  language: AppLanguage;
  total: number;
  dailyCount: number;
  weeklyCount: number;
  cureCount: number;
  ruleCount: number;
}) {
  return (
    <Card className={analysisSurfaceCardClassName}>
      <CardContent className="space-y-5 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-zinc-200">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {i18n(language, { en: "My account", fr: "Mon compte" })}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {i18n(language, { en: "My protocol", fr: "Mon protocole" })}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">
              {i18n(language, {
                en: "The unified plan built from every recommendation you've added across all your analyses. Your day, your week, your rules — in one place.",
                fr: "Le plan unifié construit à partir de toutes les recommandations que tu as ajoutées sur l'ensemble de tes analyses. Ta journée, ta semaine, tes règles — au même endroit.",
              })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat
            value={total}
            label={i18n(language, { en: "Items", fr: "Éléments" })}
          />
          <Stat
            value={dailyCount}
            label={i18n(language, { en: "Daily", fr: "Quotidien" })}
          />
          <Stat
            value={weeklyCount}
            label={i18n(language, { en: "Weekly", fr: "Hebdo" })}
          />
          <Stat
            value={ruleCount}
            label={i18n(language, { en: "Rules", fr: "Règles" })}
          />
          <Stat
            value={cureCount}
            label={i18n(language, { en: "Cures", fr: "Cures" })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <p className="font-display text-xl font-bold tabular-nums text-white">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
        {label}
      </p>
    </div>
  );
}
