import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  calculateWorkerFaceScore,
  skinRadarAxisHighlights,
  skinRadarAxisPaint,
} from "@/lib/face-analysis-score";
import {
  workerMetricAnchorId,
  scrollToWorkerAnchor,
  workerSectionAnchorId,
} from "@/lib/worker-view-anchor";
import {
  getScore,
  hasAnyScore,
  mergeHeroRightSlot,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "skin";

/* ----------------------------------------------------------------------------
 * Radar chart — skin metrics snapshot (specific to skin)
 * ------------------------------------------------------------------------- */

function SkinRadarChart({
  data,
}: {
  data: { label: string; score: number; anchorId?: string }[];
}) {
  /** Horizontal pad for clipped labels; vertical pad slightly smaller to tighten the SVG letterbox. */
  const viewPadX = 84;
  const viewPadY = 76;
  const size = 520;
  const center = size / 2;
  const maxRadius = 192;
  const n = data.length;

  /** Polar → cartesian, angle starts at the top (-90deg) and goes clockwise. */
  const polar = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / n;
    const r = (value / 10) * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const labelPolar = (index: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / n;
    const r = maxRadius + 42;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      anchor:
        Math.cos(angle) > 0.2
          ? "start"
          : Math.cos(angle) < -0.2
            ? "end"
            : "middle",
    } as const;
  };

  const valuePoints = data.map((d, i) => polar(i, d.score));
  const polygon = valuePoints.map((p) => `${p.x},${p.y}`).join(" ");
  const highlights = skinRadarAxisHighlights(data.map((d) => d.score));

  const ringValues = [2.5, 5, 7.5, 10];

  return (
    <svg
      viewBox={`-${viewPadX} -${viewPadY} ${size + 2 * viewPadX} ${size + 2 * viewPadY}`}
      className="mx-auto block h-auto w-full max-w-[min(100%,600px)] overflow-visible"
      role="img"
      aria-label="Skin radar chart"
    >
      <defs>
        <linearGradient id="skinRadarFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9aaeb5" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d6e4ff" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* Concentric grid */}
      {ringValues.map((value) => (
        <circle
          key={`ring-${value}`}
          cx={center}
          cy={center}
          r={(value / 10) * maxRadius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}

      {/* Axis spokes */}
      {data.map((_, i) => {
        const end = polar(i, 10);
        return (
          <line
            key={`spoke-${i}`}
            x1={center}
            y1={center}
            x2={end.x}
            y2={end.y}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        );
      })}

      {/* Filled polygon */}
      <polygon
        points={polygon}
        fill="url(#skinRadarFill)"
        stroke="#cfdde2"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Value markers */}
      {valuePoints.map((p, i) => {
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        const circle = (
          <circle
            cx={p.x}
            cy={p.y}
            r={4.6}
            fill={paint.dotFill}
            stroke={paint.dotStroke}
            strokeWidth="1.65"
          />
        );
        const aid = data[i]?.anchorId;
        if (!aid) return <g key={`pt-${i}`}>{circle}</g>;
        return (
          <a
            key={`pt-${i}`}
            href={`#${aid}`}
            onClick={(e) => {
              e.preventDefault();
              scrollToWorkerAnchor(aid);
            }}
            style={{ cursor: "pointer" }}
          >
            {circle}
          </a>
        );
      })}

      {/* Axis labels + scores */}
      {data.map((d, i) => {
        const lp = labelPolar(i);
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        const scoreTxt = d.score.toFixed(d.score % 1 === 0 ? 0 : 1);
        const labelFont = 15;
        const scoreFont = 12.5;
        const labels = (
          <>
            <text
              x={lp.x}
              y={lp.y - 8}
              textAnchor={lp.anchor}
              dominantBaseline="middle"
              fontSize={labelFont}
              fontWeight="600"
              fill={paint.labelFill}
              letterSpacing="0.04em"
            >
              {d.label}
            </text>
            <text
              x={lp.x}
              y={lp.y + 12}
              textAnchor={lp.anchor}
              dominantBaseline="middle"
              fontSize={scoreFont}
              fontWeight="700"
              fill={paint.previewScoreFill}
              letterSpacing="0.03em"
            >
              {scoreTxt}
              <tspan fill={paint.previewMutedFill} fontWeight="600">
                {" "}
                /10
              </tspan>
            </text>
          </>
        );
        if (!d.anchorId) return <g key={`label-${i}`}>{labels}</g>;
        return (
          <a
            key={`label-${i}`}
            href={`#${d.anchorId}`}
            onClick={(e) => {
              e.preventDefault();
              scrollToWorkerAnchor(d.anchorId!);
            }}
            style={{ cursor: "pointer" }}
          >
            {labels}
          </a>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface SkinWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
  heroAside?: React.ReactNode;
}

export function SkinWorkerView({
  aggregates,
  language,
  heroAside,
}: SkinWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );

  // ---- Texture, pores & congestion
  const poreVisibility = getScore(
    aggregates,
    "texture_pores_and_congestion.pore_size_and_visibility",
  );
  const blackheads = getScore(
    aggregates,
    "texture_pores_and_congestion.blackheads_and_congestion",
  );
  const surfaceSmoothness = getScore(
    aggregates,
    "texture_pores_and_congestion.surface_smoothness",
  );

  // ---- Acne & scarring
  const activeAcne = getScore(aggregates, "acne_and_scarring.active_acne");
  const postInflammatory = getScore(
    aggregates,
    "acne_and_scarring.post_inflammatory_marks",
  );
  const atrophicScarring = getScore(
    aggregates,
    "acne_and_scarring.atrophic_scarring",
  );

  // ---- Pigmentation, tone & redness
  const colorUniformity = getScore(
    aggregates,
    "pigmentation_tone_and_redness.color_uniformity",
  );
  const redness = getScore(
    aggregates,
    "pigmentation_tone_and_redness.redness_and_erythema",
  );

  // ---- Hydration & vitality
  const sebumHydration = getScore(
    aggregates,
    "hydration_and_vitality.sebum_hydration_balance",
  );
  const firmness = getScore(
    aggregates,
    "hydration_and_vitality.firmness_and_elasticity",
  );

  const overallNested = getScore(aggregates, "global_score.overall_skin_score");
  const overallFlat = getScore(aggregates, "overall_skin_score");
  const overallLegacy = getScore(aggregates, "overall_skin");
  const heroArgument =
    overallNested.argument ?? overallFlat.argument ?? overallLegacy.argument;

  const heroSkinScore = calculateWorkerFaceScore(WORKER_KEY, aggregates);

  // Compact axis labels for the radar (keep them short)
  const radarLabels: Record<string, { en: string; fr: string }> = {
    "texture_pores_and_congestion.pore_size_and_visibility": {
      en: "Pores",
      fr: "Pores",
    },
    "texture_pores_and_congestion.blackheads_and_congestion": {
      en: "Congestion",
      fr: "Congestion",
    },
    "texture_pores_and_congestion.surface_smoothness": {
      en: "Smoothness",
      fr: "Lissage",
    },
    "acne_and_scarring.active_acne": { en: "Acne", fr: "Acné" },
    "acne_and_scarring.post_inflammatory_marks": {
      en: "PIH",
      fr: "Marques",
    },
    "acne_and_scarring.atrophic_scarring": { en: "Scarring", fr: "Cicatrices" },
    "pigmentation_tone_and_redness.color_uniformity": {
      en: "Uniformity",
      fr: "Uniformité",
    },
    "pigmentation_tone_and_redness.redness_and_erythema": {
      en: "Redness",
      fr: "Rougeurs",
    },
    "hydration_and_vitality.sebum_hydration_balance": {
      en: "Hydration",
      fr: "Hydratation",
    },
    "hydration_and_vitality.firmness_and_elasticity": {
      en: "Firmness",
      fr: "Fermeté",
    },
  };

  const radarData = [
    {
      key: "texture_pores_and_congestion.pore_size_and_visibility",
      value: poreVisibility.score,
    },
    {
      key: "texture_pores_and_congestion.blackheads_and_congestion",
      value: blackheads.score,
    },
    {
      key: "texture_pores_and_congestion.surface_smoothness",
      value: surfaceSmoothness.score,
    },
    { key: "acne_and_scarring.active_acne", value: activeAcne.score },
    {
      key: "acne_and_scarring.post_inflammatory_marks",
      value: postInflammatory.score,
    },
    { key: "acne_and_scarring.atrophic_scarring", value: atrophicScarring.score },
    {
      key: "pigmentation_tone_and_redness.color_uniformity",
      value: colorUniformity.score,
    },
    {
      key: "pigmentation_tone_and_redness.redness_and_erythema",
      value: redness.score,
    },
    {
      key: "hydration_and_vitality.sebum_hydration_balance",
      value: sebumHydration.score,
    },
    {
      key: "hydration_and_vitality.firmness_and_elasticity",
      value: firmness.score,
    },
  ]
    .filter((d): d is { key: string; value: number } => d.value !== null)
    .map((d) => ({
      label: i18n(language, radarLabels[d.key]),
      score: d.value,
      anchorId: workerMetricAnchorId(WORKER_KEY, d.key),
    }));

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Skin overview", fr: "Vue d'ensemble peau" })}
        title={i18n(language, {
          en: "Skin",
          fr: "Peau",
        })}
        argument={heroArgument}
        score={heroSkinScore}
        scoreFractionDigits={heroSkinScore != null ? 2 : undefined}
        rightSlot={mergeHeroRightSlot(undefined, heroAside)}
      />

      {/* Radar snapshot */}
      {radarData.length >= 3 ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-7 sm:p-9">
            <div className="flex flex-col gap-5 sm:gap-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400 sm:text-base sm:tracking-[0.18em]">
                {i18n(language, {
                  en: "Skin radar",
                  fr: "Radar peau",
                })}
              </p>
              <SkinRadarChart data={radarData} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(
            poreVisibility.score,
            blackheads.score,
            surfaceSmoothness.score,
          )}
          sectionId={workerSectionAnchorId(WORKER_KEY, "texture-pores")}
          eyebrow={i18n(language, { en: "Texture & Pores", fr: "Texture et pores" })}
          title={i18n(language, {
            en: "Surface quality",
            fr: "Qualité de la surface",
          })}
        >
          <ScoreBar
            label={formatLabel(
              "texture_pores_and_congestion.pore_size_and_visibility",
            )}
            score={poreVisibility.score}
            argument={poreVisibility.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "texture_pores_and_congestion.pore_size_and_visibility",
            )}
          />
          <ScoreBar
            label={formatLabel(
              "texture_pores_and_congestion.blackheads_and_congestion",
            )}
            score={blackheads.score}
            argument={blackheads.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "texture_pores_and_congestion.blackheads_and_congestion",
            )}
          />
          <ScoreBar
            label={formatLabel("texture_pores_and_congestion.surface_smoothness")}
            score={surfaceSmoothness.score}
            argument={surfaceSmoothness.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "texture_pores_and_congestion.surface_smoothness",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(
            activeAcne.score,
            postInflammatory.score,
            atrophicScarring.score,
          )}
          sectionId={workerSectionAnchorId(WORKER_KEY, "acne-scarring")}
          eyebrow={i18n(language, {
            en: "Acne & Scarring",
            fr: "Acné et cicatrices",
          })}
          title={i18n(language, {
            en: "Active and historical signs",
            fr: "Signes actifs et historiques",
          })}
        >
          <ScoreBar
            label={formatLabel("acne_and_scarring.active_acne")}
            score={activeAcne.score}
            argument={activeAcne.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "acne_and_scarring.active_acne",
            )}
          />
          <ScoreBar
            label={formatLabel("acne_and_scarring.post_inflammatory_marks")}
            score={postInflammatory.score}
            argument={postInflammatory.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "acne_and_scarring.post_inflammatory_marks",
            )}
          />
          <ScoreBar
            label={formatLabel("acne_and_scarring.atrophic_scarring")}
            score={atrophicScarring.score}
            argument={atrophicScarring.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "acne_and_scarring.atrophic_scarring",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(colorUniformity.score, redness.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "pigmentation")}
          eyebrow={i18n(language, {
            en: "Pigmentation & Tone",
            fr: "Pigmentation et teint",
          })}
          title={i18n(language, {
            en: "Color & evenness",
            fr: "Couleur et uniformité",
          })}
        >
          <ScoreBar
            label={formatLabel("pigmentation_tone_and_redness.color_uniformity")}
            score={colorUniformity.score}
            argument={colorUniformity.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "pigmentation_tone_and_redness.color_uniformity",
            )}
          />
          <ScoreBar
            label={formatLabel(
              "pigmentation_tone_and_redness.redness_and_erythema",
            )}
            score={redness.score}
            argument={redness.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "pigmentation_tone_and_redness.redness_and_erythema",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(sebumHydration.score, firmness.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "hydration-vitality")}
          eyebrow={i18n(language, {
            en: "Hydration & Vitality",
            fr: "Hydratation et vitalité",
          })}
          title={i18n(language, {
            en: "Barrier & elasticity",
            fr: "Barrière et élasticité",
          })}
        >
          <ScoreBar
            label={formatLabel("hydration_and_vitality.sebum_hydration_balance")}
            score={sebumHydration.score}
            argument={sebumHydration.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "hydration_and_vitality.sebum_hydration_balance",
            )}
          />
          <ScoreBar
            label={formatLabel("hydration_and_vitality.firmness_and_elasticity")}
            score={firmness.score}
            argument={firmness.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "hydration_and_vitality.firmness_and_elasticity",
            )}
          />
        </SectionShell>
      </div>
    </div>
  );
}
