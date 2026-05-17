import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { BrandLoader, BrandLoaderTrack } from "@/components/ui/brand-loader";
import { Card, CardContent } from "@/components/ui/card";
import { useAppLanguage, i18n } from "@/lib/i18n";
import {
  educationalDisclaimerI18n,
  educationalDisclaimerNoticeClassName,
  educationalDisclaimerWrapperClassName,
} from "@/lib/educational-disclaimer";
import { useAnalysisHistory } from "@/hooks/use-supabase";
import { useAuth } from "@/hooks/use-auth";
import {
  useAssignStarterPresets,
  useUserRoutine,
} from "@/hooks/use-user-routine";
import {
  collectAvoidItems,
  collectEverydayHabits,
} from "@/lib/protocol-day";
import { ProtocolHubNavTabs } from "@/components/protocol/ProtocolHubNavTabs";
import { ProtocolPageShell, ProtocolPageTitle } from "@/components/protocol/ProtocolPageShell";
import { ProtocolEmptyExperience } from "@/components/protocol/ProtocolEmptyState";
import {
  ProtocolTabs,
  type ProtocolMainTab,
} from "@/components/protocol/ProtocolTabs";
import { RoutineDayCarousel } from "@/components/protocol/RoutineDayCarousel";
import { RoutineAlwaysOn } from "@/components/protocol/RoutineAlwaysOn";
import { AvoidTab } from "@/components/protocol/AvoidTab";
import { STARTER_PRESET_IDS } from "@shared/protocol-presets";

export default function ProtocolPage() {
  const language = useAppLanguage();
  const { user } = useAuth();
  const routineQuery = useUserRoutine();
  const {
    mutate: assignMissingPresets,
    isPending: isAssigningPresets,
    isError: assignPresetsError,
    error: assignPresetsErrorValue,
  } = useAssignStarterPresets();
  const { data: history = [] } = useAnalysisHistory({ enabled: !!user?.id });

  const [mainTab, setMainTab] = React.useState<ProtocolMainTab>("routine");
  const [dayOffset, setDayOffset] = React.useState(0);

  const hubNav = <ProtocolHubNavTabs language={language} active="protocol" />;

  const hasCompletedAnalysis = React.useMemo(
    () =>
      history.some((a) => a.status === "completed" && a.results.length > 0),
    [history],
  );

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

  const missingPresetIds = React.useMemo(() => {
    const active = new Set((routineQuery.data ?? []).map((p) => p.preset.id));
    return STARTER_PRESET_IDS.filter((id) => !active.has(id));
  }, [routineQuery.data]);

  React.useEffect(() => {
    if (!user?.id || !hasCompletedAnalysis) return;
    if (routineQuery.isLoading || routineQuery.isFetching) return;
    if (missingPresetIds.length === 0) return;
    if (isAssigningPresets) return;

    assignMissingPresets(missingPresetIds);
  }, [
    user?.id,
    hasCompletedAnalysis,
    routineQuery.isLoading,
    routineQuery.isFetching,
    missingPresetIds,
    isAssigningPresets,
    assignMissingPresets,
  ]);

  const presets = routineQuery.data ?? [];
  const everydayHabits = React.useMemo(
    () => collectEverydayHabits(presets, language),
    [presets, language],
  );
  const avoidItems = React.useMemo(
    () => collectAvoidItems(presets, language),
    [presets, language],
  );

  const isLoading =
    routineQuery.isLoading ||
    (hasCompletedAnalysis && presets.length === 0 && isAssigningPresets);

  const assignFailed =
    hasCompletedAnalysis && presets.length === 0 && assignPresetsError;

  if (isLoading) {
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

  if (routineQuery.error) {
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
                {routineQuery.error.message}
              </p>
            </div>
          </CardContent>
        </Card>
      </ProtocolPageShell>
    );
  }

  if (assignFailed) {
    return (
      <ProtocolPageShell topNav={hubNav} header={<ProtocolPageTitle language={language} />}>
        <Card className="border-rose-200 bg-rose-50/90 text-rose-950 shadow-none">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="font-semibold text-rose-900">
                {i18n(language, {
                  en: "Couldn't activate your routine.",
                  fr: "Impossible d'activer ta routine.",
                })}
              </p>
              <p className="mt-1 text-xs text-rose-800/90">
                {assignPresetsErrorValue instanceof Error
                  ? assignPresetsErrorValue.message
                  : String(assignPresetsErrorValue)}
              </p>
            </div>
          </CardContent>
        </Card>
      </ProtocolPageShell>
    );
  }

  if (!hasCompletedAnalysis || presets.length === 0) {
    return (
      <ProtocolEmptyExperience
        language={language}
        latestAnalysisId={latestAnalysisId}
        variant="needs_analysis"
      />
    );
  }

  return (
    <ProtocolPageShell topNav={hubNav} header={<ProtocolPageTitle language={language} />}>
      <div className="space-y-6">
        <ProtocolTabs
          language={language}
          active={mainTab}
          onChange={setMainTab}
        />

        {mainTab === "routine" ? (
          <div className="space-y-5" role="tabpanel">
            <RoutineDayCarousel
              language={language}
              presets={presets}
              selectedOffset={dayOffset}
              onSelectedOffsetChange={setDayOffset}
              userId={user?.id ?? null}
            />
            <RoutineAlwaysOn language={language} items={everydayHabits} />
          </div>
        ) : (
          <div role="tabpanel">
            <AvoidTab language={language} items={avoidItems} />
          </div>
        )}

        <div className={educationalDisclaimerWrapperClassName}>
          <p className={educationalDisclaimerNoticeClassName}>
            {i18n(language, educationalDisclaimerI18n)}
          </p>
        </div>
      </div>
    </ProtocolPageShell>
  );
}
