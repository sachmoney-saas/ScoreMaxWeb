import * as React from "react";
import { AlertTriangle, Layers, Loader2 } from "lucide-react";

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
import { ProtocolHeaderStats } from "@/components/protocol/ProtocolHeader";

export default function ProtocolPage() {
  const language = useAppLanguage();
  const { user } = useAuth();
  const breakdown = useProtocolBreakdown();
  const { data: history = [] } = useAnalysisHistory({ enabled: !!user?.id });

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
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] p-12 text-sm text-zinc-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        {i18n(language, {
          en: "Loading your protocol…",
          fr: "Chargement de ton protocole…",
        })}
      </div>
    );
  }

  if (breakdown.error) {
    return (
      <Card className="border-rose-300/30 bg-rose-500/[0.06]">
        <CardContent className="flex items-start gap-3 p-6 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-semibold">
              {i18n(language, {
                en: "Couldn't load your protocol.",
                fr: "Impossible de charger ton protocole.",
              })}
            </p>
            <p className="mt-1 text-xs text-rose-200/80">
              {breakdown.error.message}
            </p>
          </div>
        </CardContent>
      </Card>
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

  const dailyCount =
    (breakdown.bySlot.get("morning")?.length ?? 0) +
    (breakdown.bySlot.get("midday")?.length ?? 0) +
    (breakdown.bySlot.get("evening")?.length ?? 0) +
    (breakdown.bySlot.get("night")?.length ?? 0);
  const weeklyCount = breakdown.bySlot.get("weekly")?.length ?? 0;
  const ruleCount = breakdown.bySlot.get("general")?.length ?? 0;

  return (
    <div className="space-y-6">
      <ProtocolHeaderStats
        language={language}
        total={breakdown.total}
        dailyCount={dailyCount}
        weeklyCount={weeklyCount}
        cureCount={breakdown.cures.length}
        ruleCount={ruleCount}
      />

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
          eyebrow={i18n(language, { en: "Saved", fr: "Sauvegardé" })}
          title={i18n(language, {
            en: "Other items in your protocol",
            fr: "Autres éléments de ton protocole",
          })}
          description={i18n(language, {
            en: "Recommendations you saved that aren't tied to a fixed routine yet.",
            fr: "Recommandations que tu as sauvegardées sans cadence fixe pour l'instant.",
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

      <p className="border-t border-white/5 pt-4 text-[11px] leading-relaxed text-zinc-500">
        {i18n(language, {
          en: "Educational content only — not medical advice. Hard interventions require a qualified professional.",
          fr: "Contenu éducatif uniquement — ne constitue pas un avis médical. Les interventions hard nécessitent un professionnel qualifié.",
        })}
      </p>
    </div>
  );
}
