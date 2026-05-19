import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { BrandLoader, BrandLoaderTrack } from "@/components/ui/brand-loader";
import { ProtocolItemCard } from "@/components/protocol/ProtocolItemCard";
import { CureProgressBar, CureTrailing } from "@/components/protocol/protocol-cure-support";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { ProtocolCure, ProtocolItem } from "@/lib/protocol";

export interface ProtocolTodoTabProps {
  language: AppLanguage;
  cures: ProtocolCure[];
  actions: ProtocolItem[];
  isLoading: boolean;
  error: Error | null;
}

function TodoSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/80 px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {title}
        </h3>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-700 ring-1 ring-zinc-200/80">
          {count}
        </span>
      </header>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

export function ProtocolTodoTab({
  language,
  cures,
  actions,
  isLoading,
  error,
}: ProtocolTodoTabProps) {
  if (isLoading) {
    const label = i18n(language, {
      en: "Loading…",
      fr: "Chargement…",
    });
    return (
      <div
        className="flex min-h-[14rem] flex-col items-center justify-center gap-4 py-8"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <BrandLoader size="md" tone="on-dark" label={label} />
        <BrandLoaderTrack tone="on-dark" className="max-w-xs" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-rose-200 bg-rose-50/90 text-rose-950 shadow-none">
        <CardContent className="flex items-start gap-3 p-6 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold text-rose-900">
              {i18n(language, {
                en: "Couldn't load your to-do items.",
                fr: "Impossible de charger tes éléments à réaliser.",
              })}
            </p>
            <p className="mt-1 text-xs text-rose-800/90">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (cures.length === 0 && actions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-400">
        {i18n(language, {
          en: "Nothing to do yet.",
          fr: "Rien à réaliser pour l'instant.",
        })}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <TodoSection
        title={i18n(language, { en: "Cures", fr: "Cures" })}
        count={cures.length}
      >
        {cures.map((cure) => (
          <div key={cure.action.id} className="space-y-2">
            <ProtocolItemCard
              item={cure}
              language={language}
              trailing={<CureTrailing cure={cure} language={language} />}
            />
            {cure.progress !== null && cure.totalDays !== null ? (
              <div className="px-1">
                <CureProgressBar progress={cure.progress} />
                <p className="mt-1 text-[10px] text-zinc-600 tabular-nums">
                  {i18n(language, {
                    en: `${cure.elapsedDays} / ${cure.totalDays} days`,
                    fr: `${cure.elapsedDays} / ${cure.totalDays} jours`,
                  })}
                </p>
              </div>
            ) : cure.progress !== null ? (
              <div className="px-1">
                <CureProgressBar progress={cure.progress} />
              </div>
            ) : null}
          </div>
        ))}
      </TodoSection>

      <TodoSection
        title={i18n(language, {
          en: "Recommended actions",
          fr: "Actions recommandées",
        })}
        count={actions.length}
      >
        {actions.map((item) => (
          <ProtocolItemCard key={item.action.id} item={item} language={language} />
        ))}
      </TodoSection>
    </div>
  );
}
