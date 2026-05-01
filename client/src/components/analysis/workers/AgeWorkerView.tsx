import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  getNumber,
  getScore,
  getString,
  ScoreBar,
  SectionShell,
  workerSectionCardClassName,
} from "./_shared";
import { Baby, Sparkles, Scissors, Smile } from "lucide-react";

const WORKER_KEY = "age";

/* ----------------------------------------------------------------------------
 * Age extractor — supports several legacy keys
 * ------------------------------------------------------------------------- */

function extractAge(aggregates: Record<string, unknown>): number | null {
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

function extractAgeArgument(
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
 * Maturity timeline — horizontal axis from teen to mature with the user marker
 *
 * Milestones at 13 / 18 / 25 / 35 / 50, tinted gradient from juvenile → mature.
 * ------------------------------------------------------------------------- */

const MATURITY_MIN = 10;
const MATURITY_MAX = 60;
const MATURITY_MILESTONES = [
  { age: 13, en: "Teen", fr: "Ado" },
  { age: 18, en: "Young adult", fr: "Jeune adulte" },
  { age: 25, en: "Adult", fr: "Adulte" },
  { age: 35, en: "Mature", fr: "Mature" },
  { age: 50, en: "Senior", fr: "Senior" },
];

function MaturityTimeline({
  age,
  language,
}: {
  age: number;
  language: AppLanguage;
}) {
  const clamped = Math.max(MATURITY_MIN, Math.min(MATURITY_MAX, age));
  const pct = ((clamped - MATURITY_MIN) / (MATURITY_MAX - MATURITY_MIN)) * 100;

  return (
    <div className="space-y-3">
      <div className="relative">
        {/* Gradient track */}
        <div className="relative h-12 w-full overflow-hidden rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, #f6e0c7 0%, #e8c8a3 18%, #c8b09a 38%, #9aaeb5 60%, #6f7d86 80%, #3d4a52 100%)",
            }}
          />
          {/* Milestone tick marks */}
          {MATURITY_MILESTONES.map((m) => {
            const mPct =
              ((m.age - MATURITY_MIN) / (MATURITY_MAX - MATURITY_MIN)) * 100;
            return (
              <div
                key={m.age}
                className="absolute top-0 h-full w-px bg-black/30"
                style={{ left: `${mPct}%` }}
              />
            );
          })}
          {/* User marker */}
          <div
            className="pointer-events-none absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
            style={{ left: `${pct}%` }}
          />
          {/* User age callout */}
          <div
            className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full rounded-full border border-white/20 bg-zinc-950/85 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur"
            style={{ left: `${pct}%` }}
          >
            {Math.round(clamped)}
            <span className="ml-1 text-[9px] font-semibold text-zinc-400">
              {i18n(language, { en: "yrs", fr: "ans" })}
            </span>
          </div>
        </div>

        {/* Milestone labels */}
        <div className="relative mt-2 h-6">
          {MATURITY_MILESTONES.map((m) => {
            const mPct =
              ((m.age - MATURITY_MIN) / (MATURITY_MAX - MATURITY_MIN)) * 100;
            return (
              <div
                key={`label-${m.age}`}
                className="absolute -translate-x-1/2 text-center"
                style={{ left: `${mPct}%` }}
              >
                <p className="text-[9px] font-bold tabular-nums text-zinc-500">
                  {m.age}
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  {i18n(language, { en: m.en, fr: m.fr })}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        <span>{i18n(language, { en: "Juvenile", fr: "Juvénile" })}</span>
        <span>{i18n(language, { en: "Mature", fr: "Mature" })}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Neoteny composite — radial breakdown of the youthfulness signals
 * ------------------------------------------------------------------------- */

function NeotenyComposite({
  signals,
}: {
  signals: { label: string; score: number }[];
}) {
  if (signals.length < 4) return null;
  const avg =
    signals.reduce((s, x) => s + x.score, 0) / signals.length;
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 90;
  const n = signals.length;

  const polar = (i: number, value: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const r = (Math.max(0, Math.min(value, 10)) / 10) * radius;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const labelPolar = (i: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const r = radius + 22;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      anchor:
        Math.cos(angle) > 0.2
          ? "start"
          : Math.cos(angle) < -0.2
            ? "end"
            : "middle",
    } as const;
  };

  const points = signals.map((s, i) => polar(i, s.score));
  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");
  const rings = [0.33, 0.66, 1];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto block h-auto w-full max-w-[280px]"
      role="img"
      aria-label="Youthfulness signals"
    >
      <defs>
        <radialGradient id="ageRadarFill" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#e9f1f4" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#9aaeb5" stopOpacity="0.18" />
        </radialGradient>
      </defs>

      {rings.map((g) => (
        <circle
          key={g}
          cx={cx}
          cy={cy}
          r={g * radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}

      {signals.map((_, i) => {
        const e = polar(i, 10);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={e.x}
            y2={e.y}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        );
      })}

      <polygon
        points={polygon}
        fill="url(#ageRadarFill)"
        stroke="#cfdde2"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="#ffffff"
          stroke="#9aaeb5"
          strokeWidth="1.4"
        />
      ))}

      {/* center average */}
      <circle
        cx={cx}
        cy={cy}
        r={26}
        fill="rgba(0,0,0,0.4)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      />
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fill="#ffffff"
        className="font-display"
      >
        {avg.toFixed(1)}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fontSize="8"
        fontWeight="600"
        letterSpacing="0.1em"
        fill="#a0a8b3"
      >
        AVG
      </text>

      {signals.map((s, i) => {
        const lp = labelPolar(i);
        return (
          <text
            key={`lbl-${i}`}
            x={lp.x}
            y={lp.y}
            textAnchor={lp.anchor}
            dominantBaseline="middle"
            fontSize="9"
            fontWeight="600"
            fill="#aab2bd"
            letterSpacing="0.04em"
          >
            {s.label}
          </text>
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
}

export function AgeWorkerView({ aggregates, language }: AgeWorkerViewProps) {
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
    },
    {
      label: i18n(language, { en: "Soft jaw", fr: "Bas doux" }),
      score: lowerFaceSoftness.score,
    },
    {
      label: i18n(language, { en: "Skin", fr: "Peau" }),
      score: epidermalPlumpness.score,
    },
    {
      label: i18n(language, { en: "Eyes", fr: "Yeux" }),
      score: periorbital.score,
    },
    {
      label: i18n(language, { en: "Hairline", fr: "Cheveux" }),
      score: hairlineMaturation.score,
    },
    {
      label: i18n(language, { en: "Beard", fr: "Barbe" }),
      score: facialHair.score,
    },
    {
      label: i18n(language, { en: "Lips", fr: "Lèvres" }),
      score: lipPlumpness.score,
    },
    {
      label: i18n(language, { en: "Cartilage", fr: "Cartilage" }),
      score: cartilage.score,
    },
  ].filter((s): s is { label: string; score: number } => s.score !== null);

  return (
    <div className="space-y-4">
      {/* Hero — apparent age */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-10">
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
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div className="space-y-3">
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
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "From juvenile features to mature ones, your apparent age positions you on a continuous timeline. Markers indicate canonical life stages.",
                    fr: "Des traits juvéniles aux traits matures, ton âge apparent te place sur une frise continue. Les marqueurs indiquent les étapes canoniques.",
                  })}
                </p>
              </div>
              <MaturityTimeline age={age} language={language} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Neoteny composite */}
      {radarSignals.length >= 4 ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div className="space-y-3">
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
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "Eight independent signals contribute to your reading. The closer a vertex is to the outer edge, the stronger the youthful read on that signal.",
                    fr: "Huit signaux indépendants nourrissent la lecture. Plus un sommet s'approche du bord extérieur, plus le marqueur est juvénile.",
                  })}
                </p>
              </div>
              <NeotenyComposite signals={radarSignals} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Detail signal cards — grouped by category */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Facial neoteny",
            fr: "Néoténie faciale",
          })}
          title={i18n(language, {
            en: "Roundness & softness",
            fr: "Rondeur et douceur",
          })}
        >
          <div className="flex items-center gap-2 text-zinc-400">
            <Baby className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
              {i18n(language, { en: "Soft tissue signals", fr: "Tissus mous" })}
            </span>
          </div>
          <ScoreBar
            label={formatLabel(
              "facial_neoteny_and_fat.juvenile_fat_retention_roundness",
            )}
            score={fatRoundness.score}
            argument={fatRoundness.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("facial_neoteny_and_fat.lower_face_softness")}
            score={lowerFaceSoftness.score}
            argument={lowerFaceSoftness.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Skin quality",
            fr: "Qualité de la peau",
          })}
          title={i18n(language, {
            en: "Plumpness & freshness",
            fr: "Volume et fraîcheur",
          })}
        >
          <div className="flex items-center gap-2 text-zinc-400">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
              {i18n(language, { en: "Surface & glow", fr: "Surface et éclat" })}
            </span>
          </div>
          <ScoreBar
            label={formatLabel(
              "skin_quality_and_plumpness.epidermal_plumpness_baby_skin",
            )}
            score={epidermalPlumpness.score}
            argument={epidermalPlumpness.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel(
              "skin_quality_and_plumpness.periorbital_freshness",
            )}
            score={periorbital.score}
            argument={periorbital.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Hair maturation",
            fr: "Maturation capillaire",
          })}
          title={i18n(language, {
            en: "Hairline & terminal hair",
            fr: "Ligne de cheveux et pilosité",
          })}
        >
          <div className="flex items-center gap-2 text-zinc-400">
            <Scissors className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
              {i18n(language, {
                en: "Hair markers",
                fr: "Marqueurs capillaires",
              })}
            </span>
          </div>
          <ScoreBar
            label={formatLabel("hair_maturation.terminal_facial_hair_presence")}
            score={facialHair.score}
            argument={facialHair.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("hair_maturation.scalp_hairline_maturation")}
            score={hairlineMaturation.score}
            argument={hairlineMaturation.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Structural neoteny",
            fr: "Néoténie structurelle",
          })}
          title={i18n(language, {
            en: "Lips & cartilage",
            fr: "Lèvres et cartilage",
          })}
        >
          <div className="flex items-center gap-2 text-zinc-400">
            <Smile className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
              {i18n(language, {
                en: "Bone & cartilage",
                fr: "Os et cartilage",
              })}
            </span>
          </div>
          <ScoreBar
            label={formatLabel("structural_neoteny.lip_plumpness")}
            score={lipPlumpness.score}
            argument={lipPlumpness.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("structural_neoteny.cartilage_proportion")}
            score={cartilage.score}
            argument={cartilage.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
