import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Redirect } from "wouter";

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
  buildDayPlan,
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
import { RoutineDayProgressBar } from "@/components/protocol/RoutineDayProgressBar";
import { RoutineAlwaysOn } from "@/components/protocol/RoutineAlwaysOn";
import { AvoidTab } from "@/components/protocol/AvoidTab";
import { ProtocolTodoTab } from "@/components/protocol/ProtocolTodoTab";
import { ProtocolNextAnalysisCountdown } from "@/components/protocol/ProtocolNextAnalysisCountdown";
import { RecommendationTypeFilterBar } from "@/components/analysis/recommendations/RecommendationTypeFilterBar";
import { STARTER_PRESET_IDS } from "@shared/protocol-presets";
import { buildProtocolBreakdown, useProtocolBreakdown } from "@/lib/protocol";
import { useSubscriberStandardAnalysisQuota } from "@/hooks/use-supabase";

export default function ProtocolPage() {
  const language = useAppLanguage();
  const { user } = useAuth();
  const routineQuery = useUserRoutine();
  const protocolBreakdown = useProtocolBreakdown();
  const {
    mutate: assignMissingPresets,
    isPending: isAssigningPresets,
    isError: assignPresetsError,
    error: assignPresetsErrorValue,
  } = useAssignStarterPresets();
  const historyQuery = useAnalysisHistory({ enabled: !!user?.id });
  const history = historyQuery.data ?? [];

  const [mainTab, setMainTab] = React.useState<ProtocolMainTab>("routine");
  const [dayOffset, setDayOffset] = React.useState(0);
  const [showSoftmaxxing, setShowSoftmaxxing] = React.useState(true);
  const [showHardmaxxing, setShowHardmaxxing] = React.useState(true);

  const hubNav = <ProtocolHubNavTabs language={language} active="protocol" />;

  const hasCompletedAnalysis = React.useMemo(
    () =>
      history.some((a) => a.status === "completed" && a.results.length > 0),
    [history],
  );
  const subscriberQuotaQuery = useSubscriberStandardAnalysisQuota({
    enabled: hasCompletedAnalysis,
  });

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
  const visiblePresets = React.useMemo(
    () => (showSoftmaxxing ? presets : []),
    [presets, showSoftmaxxing],
  );
  const visibleProtocolBreakdown = React.useMemo(
    () =>
      buildProtocolBreakdown(
        protocolBreakdown.items.filter((item) =>
          item.recommendation.type === "soft"
            ? showSoftmaxxing
            : showHardmaxxing,
        ),
      ),
    [protocolBreakdown.items, showSoftmaxxing, showHardmaxxing],
  );
  const visibleProtocolTodoActions = React.useMemo(() => {
    const actionsById = new Map(
      visibleProtocolBreakdown.uncategorised.map((item) => [
        item.recommendation.id,
        item,
      ]),
    );

    for (const items of Array.from(visibleProtocolBreakdown.bySlot.values())) {
      for (const item of items) {
        actionsById.set(item.recommendation.id, item);
      }
    }

    return Array.from(actionsById.values());
  }, [visibleProtocolBreakdown]);
  const today = React.useMemo(() => new Date(), []);
  const everydayHabits = React.useMemo(
    () => collectEverydayHabits(visiblePresets, language),
    [visiblePresets, language],
  );
  const avoidItems = React.useMemo(
    () => collectAvoidItems(visiblePresets, language),
    [visiblePresets, language],
  );

  /**
   * Plan du jour affiché dans le header — recalculé pour le `dayOffset` courant
   * pour que la barre « Progression du jour » du bandeau métal reste en phase
   * avec le slide actuellement sélectionné dans le carrousel.
   */
  const selectedDayPlan = React.useMemo(
    () =>
      visiblePresets.length > 0
        ? buildDayPlan(visiblePresets, dayOffset, language, today)
        : null,
    [visiblePresets, dayOffset, language, today],
  );

  const isLoading =
    historyQuery.isLoading ||
    routineQuery.isLoading ||
    (hasCompletedAnalysis && presets.length === 0 && isAssigningPresets);

  const assignFailed =
    hasCompletedAnalysis && presets.length === 0 && assignPresetsError;

  if (historyQuery.isSuccess && !hasCompletedAnalysis) {
    return <Redirect to="/app/new-analysis" />;
  }

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

  if (presets.length === 0) {
    return (
      <ProtocolEmptyExperience
        language={language}
        latestAnalysisId={latestAnalysisId}
      />
    );
  }

  const showHeaderProgress = mainTab === "routine" && selectedDayPlan !== null;
  const header = (
    <div className="flex flex-col items-stretch gap-4">
      <div className="flex flex-col items-center gap-2">
        <ProtocolPageTitle language={language} />
        <ProtocolNextAnalysisCountdown
          language={language}
          nextAvailableAt={subscriberQuotaQuery.data?.next_available_at}
          onMayHaveUnlocked={() => {
            void subscriberQuotaQuery.refetch();
          }}
        />
      </div>
      {showHeaderProgress ? (
        <RoutineDayProgressBar
          language={language}
          plan={selectedDayPlan!}
          today={today}
          userId={user?.id ?? null}
          variant="header"
          className="mx-auto w-full max-w-md"
        />
      ) : null}
    </div>
  );

  return (
    <ProtocolPageShell topNav={hubNav} header={header}>
      <div className="space-y-5">
        <div className="space-y-2.5">
          <RecommendationTypeFilterBar
            showSoft={showSoftmaxxing}
            showHard={showHardmaxxing}
            onSoftChange={setShowSoftmaxxing}
            onHardChange={setShowHardmaxxing}
            language={language}
            compact
            surface="plain"
            className="px-0"
          />
          <ProtocolTabs
            language={language}
            active={mainTab}
            onChange={setMainTab}
          />
        </div>

        {mainTab === "routine" ? (
          <div className="space-y-5" role="tabpanel">
            <RoutineDayCarousel
              language={language}
              presets={visiblePresets}
              selectedOffset={dayOffset}
              onSelectedOffsetChange={setDayOffset}
              userId={user?.id ?? null}
            />
            <RoutineAlwaysOn language={language} items={everydayHabits} />
          </div>
        ) : mainTab === "todo" ? (
          <div role="tabpanel">
            <ProtocolTodoTab
              language={language}
              cures={visibleProtocolBreakdown.cures}
              actions={visibleProtocolTodoActions}
              isLoading={protocolBreakdown.isLoading}
              error={protocolBreakdown.error}
            />
          </div>
        ) : (
          <div role="tabpanel">
            <AvoidTab
              language={language}
              items={avoidItems}
              recommendations={visibleProtocolBreakdown.avoid}
            />
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
