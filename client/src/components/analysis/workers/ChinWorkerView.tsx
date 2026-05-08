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
  scrollToWorkerAnchor,
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

const WORKER_KEY = "chin";

function resolveOverallChin(aggregates: Record<string, unknown>) {
  const primary = getScore(aggregates, "global_score.overall_chin_score");
  if (primary.score !== null || primary.argument) {
    return primary;
  }
  return getScore(aggregates, "overall_chin");
}

/* ----------------------------------------------------------------------------
 * Chin shape gallery
 * ------------------------------------------------------------------------- */

type ChinShape = "round" | "pointed" | "square" | "cleft" | "oval";

const CHIN_SHAPES: {
  key: ChinShape;
  label: { en: string; fr: string };
  draw: (active: boolean) => React.ReactNode;
}[] = [
  {
    key: "round",
    label: { en: "Round", fr: "Rond" },
    draw: (active) => (
      <path
        d="M14 6 Q40 22 50 64 Q60 22 86 6"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ),
  },
  {
    key: "pointed",
    label: { en: "Pointed", fr: "Pointu" },
    draw: (active) => (
      <path
        d="M10 6 Q44 18 50 70 Q56 18 90 6"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ),
  },
  {
    key: "square",
    label: { en: "Square", fr: "Carré" },
    draw: (active) => (
      <path
        d="M14 6 Q26 26 30 56 L70 56 Q74 26 86 6"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ),
  },
  {
    key: "cleft",
    label: { en: "Cleft", fr: "Fossette" },
    draw: (active) => (
      <>
        <path
          d="M14 6 Q40 22 50 64 Q60 22 86 6"
          fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
          stroke={
            active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
          }
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <path
          d="M50 36 Q48 50 50 60 Q52 50 50 36 Z"
          fill="rgba(0,0,0,0.32)"
        />
      </>
    ),
  },
  {
    key: "oval",
    label: { en: "Oval", fr: "Ovale" },
    draw: (active) => (
      <path
        d="M12 6 Q42 20 50 60 Q58 20 88 6"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ),
  },
];

const CHIN_ALIASES: Record<string, ChinShape> = {
  round: "round",
  rounded: "round",
  rond: "round",
  pointed: "pointed",
  pointu: "pointed",
  v_shape: "pointed",
  "v-shape": "pointed",
  square: "square",
  squared: "square",
  carré: "square",
  carre: "square",
  cleft: "cleft",
  dimple: "cleft",
  fossette: "cleft",
  oval: "oval",
  ovale: "oval",
};

function normalizeChin(value: string | null): ChinShape | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return CHIN_ALIASES[k] ?? null;
}

function ChinShapeGallery({
  selected,
  language,
  taxonomyAnchorId,
}: {
  selected: ChinShape | null;
  language: AppLanguage;
  taxonomyAnchorId: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {CHIN_SHAPES.map((shape) => {
        const isActive = shape.key === selected;
        return (
          <button
            key={shape.key}
            type="button"
            onClick={() => scrollToWorkerAnchor(taxonomyAnchorId)}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-left transition hover:border-white/25 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35 ${
              isActive
                ? "border-white/45 bg-white/[0.08] shadow-[0_0_28px_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <svg
              viewBox="0 0 100 80"
              className="h-16 w-20"
              role="img"
              aria-label={shape.label.en}
            >
              {shape.draw(isActive)}
            </svg>
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
                isActive ? "text-white" : "text-zinc-500"
              }`}
            >
              {i18n(language, shape.label)}
            </span>
            {isActive ? (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

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
  const shapeKey = normalizeChin(shapeEnum.value);
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

  const chinTaxonomyAnchor = workerSectionAnchorId(WORKER_KEY, "chin-taxonomy");

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

      {/* Shape gallery */}
      <Card
        id={chinTaxonomyAnchor}
        className={`${workerSectionCardClassName} scroll-mt-28 sm:scroll-mt-32`}
      >
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, { en: "Frontal taxonomy", fr: "Taxonomie frontale" })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Where your chin sits",
                fr: "Où se situe ton menton",
              })}
            </h3>
            {shapeEnum.argument ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                {shapeEnum.argument}
              </p>
            ) : null}
          </div>
          <ChinShapeGallery
            selected={shapeKey}
            language={language}
            taxonomyAnchorId={chinTaxonomyAnchor}
          />
        </CardContent>
      </Card>

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
