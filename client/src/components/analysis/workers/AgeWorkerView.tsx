import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  skinRadarAxisHighlights,
  skinRadarAxisPaint,
} from "@/lib/face-analysis-score";
import {
  getNumber,
  getScore,
  getString,
  hasAnyScore,
  ScoreBar,
  SectionShell,
  workerSectionCardClassName,
} from "./_shared";
const WORKER_KEY = "age";

/** Ancres DOM pour lien depuis les points du radar néoténique (scroll vers les ScoreBar). */
const AGE_NEOTENY_ANCHORS = {
  roundness: "age-metric-neoteny-roundness",
  softJaw: "age-metric-neoteny-soft-jaw",
  epidermal: "age-metric-skin-epidermal",
  periorbital: "age-metric-skin-periorbital",
  hairline: "age-metric-hair-hairline",
  beard: "age-metric-hair-beard",
  lips: "age-metric-struct-lips",
  cartilage: "age-metric-struct-cartilage",
} as const;

type AgeNeotenyAnchorId =
  (typeof AGE_NEOTENY_ANCHORS)[keyof typeof AGE_NEOTENY_ANCHORS];

/* ----------------------------------------------------------------------------
 * Age extractor — supports several legacy keys
 * ------------------------------------------------------------------------- */

export function extractAge(aggregates: Record<string, unknown>): number | null {
  for (const key of [
    "age_analysis.best_estimated_age",
    "age_analysis.best_estimated_age.score",
    "estimatedAge",
    "estimated_age",
    "age",
    "apparentAge",
    "apparent_age",
  ]) {
    const v = getNumber(aggregates, key);
    if (v !== null) return v;
  }
  return null;
}

export function extractAgeArgument(
  aggregates: Record<string, unknown>,
): string | null {
  return (
    getString(aggregates, "age_analysis.age_argument") ??
    getString(aggregates, "age_analysis.argument") ??
    getString(aggregates, "age_analysis.best_estimated_age.argument") ??
    null
  );
}

/* ----------------------------------------------------------------------------
 * Frise de maturité — axe 13 → 70 ans
 *
 * • 13–20 : beige (« Enfantin », libellé sous la frise)
 * • 20–30 : bleu clair ScoreMax (libellé « Âge d'or » au-dessus de la frise)
 * • 30–40 : transition bleu clair → gris (sans texte)
 * • 40–70 : gris (« Maturité » sous la frise)
 * ------------------------------------------------------------------------- */

const MATURITY_AXIS_MIN = 13;
const MATURITY_AXIS_MAX = 70;

/** Années par bande (somme = AXIS_MAX − AXIS_MIN). */
const MATURITY_ZONE_YEAR_SPANS = [7, 10, 10, 30] as const; // 13→20, 20→30, 30→40, 40→70

const MATURITY_SPAN_YEARS = MATURITY_ZONE_YEAR_SPANS.reduce(
  (sum, y) => sum + y,
  0,
);

/** Part du bandeau occupée par la zone « âge d'or » (indices d’âge 20–30). */
const GOLDEN_BAND_LEFT_PCT =
  (MATURITY_ZONE_YEAR_SPANS[0] / MATURITY_SPAN_YEARS) * 100;
const GOLDEN_BAND_WIDTH_PCT =
  (MATURITY_ZONE_YEAR_SPANS[1] / MATURITY_SPAN_YEARS) * 100;

type MaturityZoneDef = {
  years: number;
  gradient: string;
  /** Texte sous la frise (optionnel). */
  footerLabel?: { en: string; fr: string };
};

const MATURITY_ZONES: readonly MaturityZoneDef[] = [
  {
    years: MATURITY_ZONE_YEAR_SPANS[0],
    gradient:
      "linear-gradient(180deg, #faf7f0 0%, #f1e8db 42%, #e7dcc8 100%)",
    footerLabel: { en: "Childlike", fr: "Enfantin" },
  },
  {
    years: MATURITY_ZONE_YEAR_SPANS[1],
    gradient:
      "linear-gradient(180deg, #f3f8ff 0%, #dfefff 42%, #cbe6fb 74%, #b8dcf6 100%)",
  },
  {
    years: MATURITY_ZONE_YEAR_SPANS[2],
    gradient:
      "linear-gradient(90deg, #b8dcf6 0%, #a0c8eb 22%, #86a8c9 46%, #768595 72%, #6f7c8a 100%)",
  },
  {
    years: MATURITY_ZONE_YEAR_SPANS[3],
    gradient:
      "linear-gradient(90deg, #6f7c8a 0%, #5d656e 46%, #474c54 100%)",
    footerLabel: { en: "Maturity", fr: "Maturité" },
  },
];

function ageOnMaturityAxis(age: number): number {
  return Math.max(
    MATURITY_AXIS_MIN,
    Math.min(MATURITY_AXIS_MAX, age),
  );
}

/** Position du curseur (0–100 %) sur tout l’axe 13→70 ans. */
function maturityAxisPercent(age: number): number {
  const a = ageOnMaturityAxis(age);
  const span = MATURITY_AXIS_MAX - MATURITY_AXIS_MIN;
  return ((a - MATURITY_AXIS_MIN) / span) * 100;
}

export function MaturityTimeline({
  age,
  language,
}: {
  age: number;
  language: AppLanguage;
}) {
  const pct = maturityAxisPercent(age);
  const rounded = Math.round(ageOnMaturityAxis(age));

  const zoneGridCols = MATURITY_ZONE_YEAR_SPANS.join("fr ") + "fr";

  return (
    <div className="space-y-3">
      <div className="relative pt-11">
        <div className="mb-1.5 w-full">
          <div
            className="relative mx-auto w-full max-w-full"
            style={{ minHeight: "1.125rem" }}
          >
            <p
              className="pointer-events-none absolute top-0 whitespace-nowrap text-center text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-zinc-300"
              style={{
                left: `${GOLDEN_BAND_LEFT_PCT}%`,
                width: `${GOLDEN_BAND_WIDTH_PCT}%`,
              }}
            >
              {i18n(language, { en: "Golden age", fr: "Âge d'or" })}
            </p>
          </div>
        </div>

        <div className="relative h-[3.65rem] w-full overflow-hidden rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex h-full w-full">
            {MATURITY_ZONES.map((zone, idx) => (
              <div
                key={idx}
                className="relative shrink-0 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]"
                style={{
                  flexGrow: zone.years,
                  flexBasis: 0,
                  minWidth: 0,
                  background: zone.gradient,
                }}
              />
            ))}
          </div>
          <div
            className="pointer-events-none absolute top-0 z-[2] h-full w-[4px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(0,0,0,0.5)]"
            style={{ left: `${pct}%` }}
          />
          <div
            className="pointer-events-none absolute -top-1 z-[3] flex -translate-x-1/2 -translate-y-full flex-col items-center"
            style={{ left: `${pct}%` }}
          >
            <div className="rounded-full border border-white/40 bg-zinc-950/92 px-2.5 py-1 shadow-lg backdrop-blur">
              <span className="text-[13px] font-bold tabular-nums leading-none text-white">
                {rounded}
              </span>
              <span className="ml-1 align-middle text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                {i18n(language, { en: "yrs", fr: "ans" })}
              </span>
            </div>
            <div className="-mt-px h-2 w-[3px] rounded-b-[2px] bg-white shadow-[inset_-1px_0_0_rgba(0,0,0,0.35)]" />
          </div>
        </div>

        <div
          className="mt-3 grid gap-2 text-center"
          style={{ gridTemplateColumns: zoneGridCols }}
        >
          {MATURITY_ZONES.map((zone, idx) => (
            <div key={`lab-${idx}`} className="min-w-0 px-1">
              {zone.footerLabel ? (
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                  {i18n(language, zone.footerLabel)}
                </p>
              ) : (
                <span className="block min-h-[0.875rem]" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-semibold tabular-nums tracking-[0.12em] text-zinc-300">
        <span>
          {MATURITY_AXIS_MIN}
          <span className="ml-0.5 font-medium normal-case">
            {i18n(language, { en: " yrs", fr: " ans" })}
          </span>
        </span>
        <span>
          70+
          <span className="ml-0.5 font-medium normal-case">
            {i18n(language, { en: " yrs", fr: " ans" })}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Neoteny composite — radial breakdown of the youthfulness signals
 * ------------------------------------------------------------------------- */

function NeotenyComposite({
  signals,
  language,
}: {
  signals: { label: string; score: number; anchorId: AgeNeotenyAnchorId }[];
  language: AppLanguage;
}) {
  if (signals.length < 4) return null;
  const avg =
    signals.reduce((s, x) => s + x.score, 0) / signals.length;

  /** Same letterboxing as `SkinRadarChart` so axis labels are not clipped. */
  const viewPadX = 62;
  const viewPadY = 62;
  const size = 400;
  const center = size / 2;
  const maxRadius = 146;
  const n = signals.length;
  const hubR = 30;

  const highlights = skinRadarAxisHighlights(signals.map((s) => s.score));

  const polar = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / n;
    const r = (Math.max(0, Math.min(value, 10)) / 10) * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const labelPolar = (index: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / n;
    const r = maxRadius + 34;
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

  const valuePoints = signals.map((s, i) => polar(i, s.score));
  const polygon = valuePoints.map((p) => `${p.x},${p.y}`).join(" ");
  const ringValues = [2.5, 5, 7.5, 10];

  return (
    <svg
      viewBox={`-${viewPadX} -${viewPadY} ${size + 2 * viewPadX} ${size + 2 * viewPadY}`}
      className="mx-auto block h-auto w-full max-w-[420px] overflow-visible"
      role="img"
      aria-label={i18n(language, {
        en: "Youthfulness radar — dots link to metric details below",
        fr: "Toile des signaux de jeunesse — les points renvoient vers le détail plus bas",
      })}
    >
      <defs>
        <linearGradient id="ageNeotenyRadarFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9aaeb5" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d6e4ff" stopOpacity="0.25" />
        </linearGradient>
      </defs>

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

      {signals.map((_, i) => {
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

      <polygon
        points={polygon}
        fill="url(#ageNeotenyRadarFill)"
        stroke="#cfdde2"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {valuePoints.map((p, i) => {
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        const sig = signals[i]!;
        const labelGo = i18n(language, {
          en: `Go to detail: ${sig.label}`,
          fr: `Aller au détail : ${sig.label}`,
        });
        return (
          <a
            key={`pt-${sig.anchorId}`}
            href={`#${sig.anchorId}`}
            aria-label={labelGo}
            className="outline-none transition-opacity hover:opacity-95"
            style={{ cursor: "pointer" }}
          >
            <g>
              <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={3.6}
                fill={paint.dotFill}
                stroke={paint.dotStroke}
                strokeWidth="1.5"
              />
            </g>
          </a>
        );
      })}

      <circle
        cx={center}
        cy={center}
        r={hubR}
        fill="rgba(0,0,0,0.4)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      />
      <text
        x={center}
        y={center - 3}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="20"
        fontWeight="700"
        fill="#ffffff"
        className="font-display"
      >
        {avg.toFixed(1)}
      </text>
      <text
        x={center}
        y={center + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="9"
        fontWeight="600"
        letterSpacing="0.1em"
        fill="#a0a8b3"
      >
        AVG
      </text>

      {signals.map((s, i) => {
        const lp = labelPolar(i);
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        const scoreTxt = s.score.toFixed(s.score % 1 === 0 ? 0 : 1);
        return (
          <React.Fragment key={`lbl-${i}`}>
            <text
              x={lp.x}
              y={lp.y - 8}
              textAnchor={lp.anchor}
              dominantBaseline="middle"
              fontSize="11"
              fontWeight="600"
              fill={paint.labelFill}
              letterSpacing="0.04em"
            >
              {s.label}
            </text>
            <text
              x={lp.x}
              y={lp.y + 14}
              textAnchor={lp.anchor}
              dominantBaseline="middle"
              fontSize="9.5"
              fontWeight="700"
              fill={paint.previewScoreFill}
              letterSpacing="0.03em"
            >
              {scoreTxt}
              <tspan fill={paint.previewMutedFill} fontWeight="600">
                {" /10"}
              </tspan>
            </text>
          </React.Fragment>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface AgeWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
  heroAside?: React.ReactNode;
}

export function AgeWorkerView({
  aggregates,
  language,
  heroAside,
}: AgeWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );

  const age = extractAge(aggregates);
  const argument = extractAgeArgument(aggregates);

  const fatRoundness = getScore(
    aggregates,
    "facial_neoteny_and_fat.juvenile_fat_retention_roundness",
  );
  const lowerFaceSoftness = getScore(
    aggregates,
    "facial_neoteny_and_fat.lower_face_softness",
  );
  const epidermalPlumpness = getScore(
    aggregates,
    "skin_quality_and_plumpness.epidermal_plumpness_baby_skin",
  );
  const periorbital = getScore(
    aggregates,
    "skin_quality_and_plumpness.periorbital_freshness",
  );
  const facialHair = getScore(
    aggregates,
    "hair_maturation.terminal_facial_hair_presence",
  );
  const hairlineMaturation = getScore(
    aggregates,
    "hair_maturation.scalp_hairline_maturation",
  );
  const lipPlumpness = getScore(aggregates, "structural_neoteny.lip_plumpness");
  const cartilage = getScore(
    aggregates,
    "structural_neoteny.cartilage_proportion",
  );

  // Compact short labels for the radar polygon
  const radarSignals = [
    {
      label: i18n(language, { en: "Roundness", fr: "Rondeur" }),
      score: fatRoundness.score,
      anchorId: AGE_NEOTENY_ANCHORS.roundness,
    },
    {
      label: i18n(language, { en: "Soft jaw", fr: "Bas doux" }),
      score: lowerFaceSoftness.score,
      anchorId: AGE_NEOTENY_ANCHORS.softJaw,
    },
    {
      label: i18n(language, { en: "Skin", fr: "Peau" }),
      score: epidermalPlumpness.score,
      anchorId: AGE_NEOTENY_ANCHORS.epidermal,
    },
    {
      label: i18n(language, { en: "Eyes", fr: "Yeux" }),
      score: periorbital.score,
      anchorId: AGE_NEOTENY_ANCHORS.periorbital,
    },
    {
      label: i18n(language, { en: "Hairline", fr: "Cheveux" }),
      score: hairlineMaturation.score,
      anchorId: AGE_NEOTENY_ANCHORS.hairline,
    },
    {
      label: i18n(language, { en: "Beard", fr: "Barbe" }),
      score: facialHair.score,
      anchorId: AGE_NEOTENY_ANCHORS.beard,
    },
    {
      label: i18n(language, { en: "Lips", fr: "Lèvres" }),
      score: lipPlumpness.score,
      anchorId: AGE_NEOTENY_ANCHORS.lips,
    },
    {
      label: i18n(language, { en: "Cartilage", fr: "Cartilage" }),
      score: cartilage.score,
      anchorId: AGE_NEOTENY_ANCHORS.cartilage,
    },
  ].filter(
    (s): s is {
      label: string;
      score: number;
      anchorId: AgeNeotenyAnchorId;
    } => s.score !== null,
  );

  return (
    <div className="space-y-4">
      {/* Hero — apparent age */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="relative p-6 sm:p-10">
          {heroAside ? (
            <div className="absolute right-4 top-4 z-10 max-w-[min(100%-2rem,14rem)] sm:right-8 sm:top-8 sm:max-w-none">
              {heroAside}
            </div>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                {i18n(language, {
                  en: "Apparent age",
                  fr: "Âge apparent",
                })}
              </p>
              <div className="mt-2 flex items-end gap-3">
                <h2 className="font-display text-7xl font-bold leading-none tracking-[-0.08em] text-white sm:text-8xl">
                  {age !== null ? Math.round(age) : "—"}
                </h2>
                <span className="mb-3 text-2xl font-semibold text-zinc-300">
                  {i18n(language, { en: "yrs", fr: "ans" })}
                </span>
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              {argument ? (
                <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
                  {argument}
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "This estimation reflects the apparent age perceived from your photo, not your biological age. It can vary with lighting, angle and expression.",
                    fr: "Cette estimation reflète l'âge apparent perçu sur ta photo, pas ton âge biologique. Elle peut varier selon la lumière, l'angle et l'expression.",
                  })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maturity timeline */}
      {age !== null ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr] lg:items-start lg:gap-5">
              <div className="min-w-0 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {i18n(language, {
                    en: "Maturity timeline",
                    fr: "Frise de maturité",
                  })}
                </p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {i18n(language, {
                    en: "Where you sit on the spectrum",
                    fr: "Ta position sur le spectre",
                  })}
                </h3>
              </div>
              <MaturityTimeline age={age} language={language} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Neoteny composite */}
      {radarSignals.length >= 4 ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div className="space-y-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, {
                  en: "Youthfulness signals",
                  fr: "Signaux de jeunesse",
                })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "What pulls your apparent age",
                  fr: "Ce qui tire ton âge apparent",
                })}
              </h3>
            </div>
            <NeotenyComposite signals={radarSignals} language={language} />
          </CardContent>
        </Card>
      ) : null}

      {/* Detail signal cards — grouped by category */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(fatRoundness.score, lowerFaceSoftness.score)}
          eyebrow={i18n(language, {
            en: "Facial neoteny",
            fr: "Néoténie faciale",
          })}
          title={i18n(language, {
            en: "Roundness & softness",
            fr: "Rondeur et douceur",
          })}
        >
          <ScoreBar
            label={formatLabel(
              "facial_neoteny_and_fat.juvenile_fat_retention_roundness",
            )}
            score={fatRoundness.score}
            argument={fatRoundness.argument}
            language={language}
            scrollTargetId={AGE_NEOTENY_ANCHORS.roundness}
          />
          <ScoreBar
            label={formatLabel("facial_neoteny_and_fat.lower_face_softness")}
            score={lowerFaceSoftness.score}
            argument={lowerFaceSoftness.argument}
            language={language}
            scrollTargetId={AGE_NEOTENY_ANCHORS.softJaw}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(epidermalPlumpness.score, periorbital.score)}
          eyebrow={i18n(language, {
            en: "Skin quality",
            fr: "Qualité de la peau",
          })}
          title={i18n(language, {
            en: "Plumpness & freshness",
            fr: "Volume et fraîcheur",
          })}
        >
          <ScoreBar
            label={formatLabel(
              "skin_quality_and_plumpness.epidermal_plumpness_baby_skin",
            )}
            score={epidermalPlumpness.score}
            argument={epidermalPlumpness.argument}
            language={language}
            scrollTargetId={AGE_NEOTENY_ANCHORS.epidermal}
          />
          <ScoreBar
            label={formatLabel(
              "skin_quality_and_plumpness.periorbital_freshness",
            )}
            score={periorbital.score}
            argument={periorbital.argument}
            language={language}
            scrollTargetId={AGE_NEOTENY_ANCHORS.periorbital}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(facialHair.score, hairlineMaturation.score)}
          eyebrow={i18n(language, {
            en: "Hair maturation",
            fr: "Maturation capillaire",
          })}
          title={i18n(language, {
            en: "Hairline & terminal hair",
            fr: "Ligne de cheveux et pilosité",
          })}
        >
          <ScoreBar
            label={formatLabel("hair_maturation.terminal_facial_hair_presence")}
            score={facialHair.score}
            argument={facialHair.argument}
            language={language}
            scrollTargetId={AGE_NEOTENY_ANCHORS.beard}
          />
          <ScoreBar
            label={formatLabel("hair_maturation.scalp_hairline_maturation")}
            score={hairlineMaturation.score}
            argument={hairlineMaturation.argument}
            language={language}
            scrollTargetId={AGE_NEOTENY_ANCHORS.hairline}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(lipPlumpness.score, cartilage.score)}
          eyebrow={i18n(language, {
            en: "Structural neoteny",
            fr: "Néoténie structurelle",
          })}
          title={i18n(language, {
            en: "Lips & cartilage",
            fr: "Lèvres et cartilage",
          })}
        >
          <ScoreBar
            label={formatLabel("structural_neoteny.lip_plumpness")}
            score={lipPlumpness.score}
            argument={lipPlumpness.argument}
            language={language}
            scrollTargetId={AGE_NEOTENY_ANCHORS.lips}
          />
          <ScoreBar
            label={formatLabel("structural_neoteny.cartilage_proportion")}
            score={cartilage.score}
            argument={cartilage.argument}
            language={language}
            scrollTargetId={AGE_NEOTENY_ANCHORS.cartilage}
          />
        </SectionShell>
      </div>
    </div>
  );
}
