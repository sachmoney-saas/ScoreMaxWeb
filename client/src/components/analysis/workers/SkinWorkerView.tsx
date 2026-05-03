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
  getScore,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "skin";

/* ----------------------------------------------------------------------------
 * Radar chart — 9 axes snapshot (specific to skin)
 * ------------------------------------------------------------------------- */

function SkinRadarChart({
  data,
}: {
  data: { label: string; score: number }[];
}) {
  /** Horizontal pad for clipped labels; vertical pad slightly smaller to tighten the SVG letterbox. */
  const viewPadX = 62;
  const viewPadY = 50;
  const size = 400;
  const center = size / 2;
  const maxRadius = 146;
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
    const r = maxRadius + 26;
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
      className="mx-auto block h-auto w-full max-w-[420px] overflow-visible"
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
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Value markers */}
      {valuePoints.map((p, i) => {
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        return (
          <circle
            key={`pt-${i}`}
            cx={p.x}
            cy={p.y}
            r={3.4}
            fill={paint.dotFill}
            stroke={paint.dotStroke}
            strokeWidth="1.5"
          />
        );
      })}

      {/* Axis labels */}
      {data.map((d, i) => {
        const lp = labelPolar(i);
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        return (
          <text
            key={`label-${i}`}
            x={lp.x}
            y={lp.y}
            textAnchor={lp.anchor}
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="600"
            fill={paint.labelFill}
            letterSpacing="0.04em"
          >
            {d.label}
          </text>
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
}

export function SkinWorkerView({ aggregates, language }: SkinWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );

  // ---- Texture & pores
  const poreVisibility = getScore(
    aggregates,
    "texture_and_pores.pore_size_visibility",
  );
  const blackheads = getScore(
    aggregates,
    "texture_and_pores.blackheads_and_congestion",
  );
  const surfaceSmoothness = getScore(
    aggregates,
    "texture_and_pores.surface_smoothness",
  );

  // ---- Acne & scarring
  const activeAcne = getScore(aggregates, "acne_and_scarring.active_acne");
  const atrophicScarring = getScore(
    aggregates,
    "acne_and_scarring.atrophic_scarring",
  );

  // ---- Pigmentation & tone
  const colorUniformity = getScore(
    aggregates,
    "pigmentation_and_tone.color_uniformity",
  );
  const redness = getScore(
    aggregates,
    "pigmentation_and_tone.redness_and_erythema",
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

  // ---- Global (supports legacy & doc'd keys)
  const globalScore =
    getScore(aggregates, "overall_skin_score").score !== null
      ? getScore(aggregates, "overall_skin_score")
      : getScore(aggregates, "overall_skin");

  const heroSkinScore = calculateWorkerFaceScore(WORKER_KEY, aggregates);

  // Compact axis labels for the radar (keep them short)
  const radarLabels: Record<string, { en: string; fr: string }> = {
    "texture_and_pores.pore_size_visibility": { en: "Pores", fr: "Pores" },
    "texture_and_pores.blackheads_and_congestion": {
      en: "Congestion",
      fr: "Congestion",
    },
    "texture_and_pores.surface_smoothness": {
      en: "Smoothness",
      fr: "Lissage",
    },
    "acne_and_scarring.active_acne": { en: "Acne", fr: "Acné" },
    "acne_and_scarring.atrophic_scarring": { en: "Scarring", fr: "Cicatrices" },
    "pigmentation_and_tone.color_uniformity": {
      en: "Uniformity",
      fr: "Uniformité",
    },
    "pigmentation_and_tone.redness_and_erythema": {
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
    { key: "texture_and_pores.pore_size_visibility", value: poreVisibility.score },
    { key: "texture_and_pores.blackheads_and_congestion", value: blackheads.score },
    { key: "texture_and_pores.surface_smoothness", value: surfaceSmoothness.score },
    { key: "acne_and_scarring.active_acne", value: activeAcne.score },
    { key: "acne_and_scarring.atrophic_scarring", value: atrophicScarring.score },
    { key: "pigmentation_and_tone.color_uniformity", value: colorUniformity.score },
    { key: "pigmentation_and_tone.redness_and_erythema", value: redness.score },
    { key: "hydration_and_vitality.sebum_hydration_balance", value: sebumHydration.score },
    { key: "hydration_and_vitality.firmness_and_elasticity", value: firmness.score },
  ]
    .filter((d): d is { key: string; value: number } => d.value !== null)
    .map((d) => ({
      label: i18n(language, radarLabels[d.key]),
      score: d.value,
    }));

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Skin overview", fr: "Vue d'ensemble peau" })}
        title={i18n(language, {
          en: "Your skin profile",
          fr: "Ton profil de peau",
        })}
        argument={globalScore.argument}
        score={heroSkinScore}
        scoreFractionDigits={heroSkinScore != null ? 2 : undefined}
      />

      {/* Radar snapshot */}
      {radarData.length >= 3 ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr] lg:items-start lg:gap-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {i18n(language, {
                    en: "Skin radar",
                    fr: "Radar peau",
                  })}
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {i18n(language, {
                    en: "All dimensions at a glance",
                    fr: "Toutes les dimensions d'un coup d'œil",
                  })}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "The shape of the polygon shows where your skin currently shines and where it can improve. The closer a vertex is to the outer edge, the better the score on that dimension.",
                    fr: "La forme du polygone montre où ta peau brille déjà et où elle peut s'améliorer. Plus un sommet s'approche du bord extérieur, plus le score est élevé sur cette dimension.",
                  })}
                </p>
              </div>
              <SkinRadarChart data={radarData} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, { en: "Texture & Pores", fr: "Texture et pores" })}
          title={i18n(language, {
            en: "Surface quality",
            fr: "Qualité de la surface",
          })}
        >
          <ScoreBar
            label={formatLabel("texture_and_pores.pore_size_visibility")}
            score={poreVisibility.score}
            argument={poreVisibility.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("texture_and_pores.blackheads_and_congestion")}
            score={blackheads.score}
            argument={blackheads.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("texture_and_pores.surface_smoothness")}
            score={surfaceSmoothness.score}
            argument={surfaceSmoothness.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
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
          />
          <ScoreBar
            label={formatLabel("acne_and_scarring.atrophic_scarring")}
            score={atrophicScarring.score}
            argument={atrophicScarring.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
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
            label={formatLabel("pigmentation_and_tone.color_uniformity")}
            score={colorUniformity.score}
            argument={colorUniformity.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("pigmentation_and_tone.redness_and_erythema")}
            score={redness.score}
            argument={redness.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
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
          />
          <ScoreBar
            label={formatLabel("hydration_and_vitality.firmness_and_elasticity")}
            score={firmness.score}
            argument={firmness.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
