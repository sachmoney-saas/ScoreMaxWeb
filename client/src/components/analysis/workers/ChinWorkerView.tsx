import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { calculateWorkerFaceScore } from "@/lib/face-analysis-score";
import {
  workerMetricAnchorId,
  workerSectionAnchorId,
} from "@/lib/worker-view-anchor";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  getEnum,
  getScore,
  hasAnyScore,
  mergeHeroRightSlot,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";
import {
  WorkerSignatureRadar,
  type WorkerSignatureRadarPoint,
} from "./WorkerVisualizations";

const WORKER_KEY = "chin";

function resolveOverallChin(aggregates: Record<string, unknown>) {
  const primary = getScore(aggregates, "global_score.overall_chin_score");
  if (primary.score !== null || primary.argument) {
    return primary;
  }
  return getScore(aggregates, "overall_chin");
}

export interface ChinWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
  heroAside?: React.ReactNode;
}

export function ChinWorkerView({
  aggregates,
  language,
  heroAside,
}: ChinWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );
  const formatEnumValue = React.useCallback(
    (key: string, value: string | null) =>
      value
        ? formatAggregateDisplayValue(WORKER_KEY, key, value, locale)
        : null,
    [locale],
  );

  const overall = resolveOverallChin(aggregates);

  // Shape & contour
  const shapeEnum = getEnum(aggregates, "shape_and_contour.chin_shape");
  const shapeDisplay = formatEnumValue("shape_and_contour.chin_shape", shapeEnum.value);
  const contour = getScore(aggregates, "shape_and_contour.chin_contour");
  const dimpleEnum = getEnum(aggregates, "shape_and_contour.chin_dimple");

  // Projection
  const projection = getScore(aggregates, "projection_and_profile.chin_projection");
  const height = getScore(aggregates, "projection_and_profile.chin_height");

  // Width & integration
  const width = getScore(aggregates, "width_and_integration.chin_width");
  const lowerFaceIntegration = getScore(
    aggregates,
    "width_and_integration.lower_face_integration",
  );

  const radarLabels: Record<string, { en: string; fr: string }> = {
    "shape_and_contour.chin_contour": { en: "Contour", fr: "Contour" },
    "projection_and_profile.chin_projection": {
      en: "Projection",
      fr: "Projection",
    },
    "projection_and_profile.chin_height": { en: "Height", fr: "Hauteur" },
    "width_and_integration.chin_width": { en: "Width", fr: "Largeur" },
    "width_and_integration.lower_face_integration": {
      en: "Lower-face fit",
      fr: "Intégration\nbas visage",
    },
  };

  const radarSource: { key: string; score: number | null }[] = [
    { key: "shape_and_contour.chin_contour", score: contour.score },
    { key: "projection_and_profile.chin_projection", score: projection.score },
    { key: "projection_and_profile.chin_height", score: height.score },
    { key: "width_and_integration.chin_width", score: width.score },
    {
      key: "width_and_integration.lower_face_integration",
      score: lowerFaceIntegration.score,
    },
  ];

  const radarData: WorkerSignatureRadarPoint[] = radarSource.flatMap((d) =>
    d.score === null
      ? []
      : [
          {
            label: i18n(language, radarLabels[d.key]),
            score: d.score,
            anchorId: workerMetricAnchorId(WORKER_KEY, d.key),
          },
        ],
  );

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Chin architecture", fr: "Architecture du menton" })}
        title={i18n(language, {
          en: "Your chin signature",
          fr: "Ta signature mentonnière",
        })}
        argument={overall.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={mergeHeroRightSlot(
          shapeDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Chin shape", fr: "Forme" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {shapeDisplay}
              </p>
            </div>
          ) : null,
          heroAside,
        )}
      />

      {radarData.length >= 3 ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 sm:text-[13px] sm:tracking-[0.2em]">
                {i18n(language, {
                  en: "Chin signature",
                  fr: "Signature mentonnière",
                })}
              </p>
              <WorkerSignatureRadar
                data={radarData}
                ariaLabel={i18n(language, {
                  en: "Chin metrics radar",
                  fr: "Toile des métriques menton",
                })}
                sizePreset="large"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(contour.score) || Boolean(dimpleEnum.value)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "shape-contour")}
          eyebrow={i18n(language, { en: "Shape & contour", fr: "Forme et contour" })}
          title={i18n(language, {
            en: "Contour & detail",
            fr: "Contour et détail",
          })}
        >
          <ScoreBar
            label={formatLabel("shape_and_contour.chin_contour")}
            score={contour.score}
            argument={contour.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "shape_and_contour.chin_contour",
            )}
          />
          {dimpleEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("shape_and_contour.chin_dimple")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue("shape_and_contour.chin_dimple", dimpleEnum.value)}
                </span>
              </div>
              {dimpleEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {dimpleEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>

        <SectionShell
          when={hasAnyScore(projection.score, height.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "projection")}
          eyebrow={i18n(language, { en: "Projection", fr: "Projection" })}
          title={i18n(language, {
            en: "Forward push & height",
            fr: "Avancée et hauteur",
          })}
        >
          <ScoreBar
            label={formatLabel("projection_and_profile.chin_projection")}
            score={projection.score}
            argument={projection.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "projection_and_profile.chin_projection",
            )}
          />
          <ScoreBar
            label={formatLabel("projection_and_profile.chin_height")}
            score={height.score}
            argument={height.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "projection_and_profile.chin_height",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(width.score, lowerFaceIntegration.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "width-integration")}
          eyebrow={i18n(language, {
            en: "Width & integration",
            fr: "Largeur et intégration",
          })}
          title={i18n(language, {
            en: "Lower-face integration",
            fr: "Intégration du bas du visage",
          })}
        >
          <ScoreBar
            label={formatLabel("width_and_integration.chin_width")}
            score={width.score}
            argument={width.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "width_and_integration.chin_width",
            )}
          />
          <ScoreBar
            label={formatLabel("width_and_integration.lower_face_integration")}
            score={lowerFaceIntegration.score}
            argument={lowerFaceIntegration.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "width_and_integration.lower_face_integration",
            )}
          />
        </SectionShell>
      </div>
    </div>
  );
}
