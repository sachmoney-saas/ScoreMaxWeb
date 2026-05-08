import * as React from "react";
import { AlertTriangle, Layers } from "lucide-react";

import { BrandLoader, BrandLoaderTrack } from "@/components/ui/brand-loader";
import { Card, CardContent } from "@/components/ui/card";
import { useAppLanguage, i18n } from "@/lib/i18n";
import { useProtocolBreakdown } from "@/lib/protocol";
import { useAnalysisHistory } from "@/hooks/use-supabase";
import { useAuth } from "@/hooks/use-auth";
import { ProtocolDay } from "@/components/protocol/ProtocolDay";
import { ProtocolWeekly } from "@/components/protocol/ProtocolWeekly";
import { ProtocolGeneralRules } from "@/components/protocol/ProtocolGeneralRules";
import { ProtocolActiveCures } from "@/components/protocol/ProtocolActiveCures";
import { ProtocolEmptyExperience } from "@/components/protocol/ProtocolEmptyState";
import { ProtocolItemCard } from "@/components/protocol/ProtocolItemCard";
import { ProtocolSection } from "@/components/protocol/ProtocolSection";
import { ProtocolHubNavTabs } from "@/components/protocol/ProtocolHubNavTabs";
import { ProtocolPageShell, ProtocolPageTitle } from "@/components/protocol/ProtocolPageShell";

export default function ProtocolPage() {
  const language = useAppLanguage();
  const { user } = useAuth();
  const breakdown = useProtocolBreakdown();
  const { data: history = [] } = useAnalysisHistory({ enabled: !!user?.id });

  const hubNav = <ProtocolHubNavTabs language={language} active="protocol" />;

  const latestAnalysisId = React.useMemo(() => {
    const completed = history
      .filter((a) => a.status === "completed" && a.results.length > 0)
      .sort((a, b) => {
        const ta = new Date(a.completed_at ?? a.created_at).getTime();
        const tb = new Date(b.completed_at ?? b.created_at).getTime();
        return tb - ta;
      });
    return completed[0]?.id ?? null;
  }, [history]);

  if (breakdown.isLoading) {
    const loadingLabel = i18n(language, {
      en: "Loading your protocol…",
      fr: "Chargement de ton protocole…",
    });
    return (
      <ProtocolPageShell topNav={hubNav} header={<ProtocolPageTitle language={language} />}>
        <div
          className="flex min-h-[min(400px,55vh)] w-full flex-col items-center justify-center gap-5 py-8"
          role="status"
          aria-busy="true"
          aria-live="polite"
        >
          <BrandLoader size="lg" tone="on-dark" label={loadingLabel} />
          <BrandLoaderTrack tone="on-dark" />
          <p className="text-center text-sm font-medium tracking-tight text-zinc-300">
            {loadingLabel}
          </p>
        </div>
      </ProtocolPageShell>
    );
  }

  if (breakdown.error) {
    return (
      <ProtocolPageShell topNav={hubNav} header={<ProtocolPageTitle language={language} />}>
        <Card className="border-rose-200 bg-rose-50/90 text-rose-950 shadow-none">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="font-semibold text-rose-900">
                {i18n(language, {
                  en: "Couldn't load your protocol.",
                  fr: "Impossible de charger ton protocole.",
                })}
              </p>
              <p className="mt-1 text-xs text-rose-800/90">
                {breakdown.error.message}
              </p>
            </div>
          </CardContent>
        </Card>
      </ProtocolPageShell>
    );
  }

  if (breakdown.total === 0) {
    return (
      <ProtocolEmptyExperience
        language={language}
        latestAnalysisId={latestAnalysisId}
      />
    );
  }

  return (
    <ProtocolPageShell topNav={hubNav} header={<ProtocolPageTitle language={language} />}>
      <div className="space-y-8">
        <ProtocolDay itemsBySlot={breakdown.bySlot} language={language} />

        <ProtocolWeekly
          items={breakdown.bySlot.get("weekly") ?? []}
          language={language}
        />

        <ProtocolGeneralRules
          items={breakdown.bySlot.get("general") ?? []}
          language={language}
        />

        <ProtocolActiveCures cures={breakdown.cures} language={language} />

        {breakdown.uncategorised.length > 0 ? (
          <ProtocolSection
            variant="sheet"
            title={i18n(language, {
              en: "Other items",
              fr: "Autres éléments",
            })}
            icon={Layers}
            count={breakdown.uncategorised.length}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {breakdown.uncategorised.map((item) => (
                <ProtocolItemCard
                  key={item.action.id}
                  item={item}
                  language={language}
                />
              ))}
            </div>
          </ProtocolSection>
        ) : null}

        <p className="border-t border-white/10 pt-4 text-[11px] leading-relaxed text-zinc-400">
          {i18n(language, {
            en: "Educational content only — not medical advice. Hard interventions require a qualified professional.",
            fr: "Contenu éducatif uniquement — ne constitue pas un avis médical. Les interventions hard nécessitent un professionnel qualifié.",
          })}
        </p>
      </div>
    </ProtocolPageShell>
  );
}
