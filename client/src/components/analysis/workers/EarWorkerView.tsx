import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  bandFromScore,
  getEnum,
  getScore,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "ear";

/* ----------------------------------------------------------------------------
 * Anatomical ear illustration
 *
 * A side-profile face stub with an ear illustrated in detail. Helix +
 * antihelix + lobe are highlighted based on architecture / symmetry scores.
 * ------------------------------------------------------------------------- */

function EarAnatomy({
  projection,
  cartilage,
  symmetry,
  language,
}: {
  projection: number | null;
  cartilage: number | null;
  symmetry: number | null;
  language: AppLanguage;
}) {
  const proj =
    projection !== null ? Math.max(0, Math.min(10, projection)) : 5;
  const cart = cartilage !== null ? Math.max(0, Math.min(10, cartilage)) : 5;

  // Projection translates the ear to the right (away from skull)
  const earOffsetX = (proj / 10) * 16;

  // Cartilage definition strengthens the antihelix stroke
  const antihelixAlpha = 0.25 + (cart / 10) * 0.55;

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 220 200"
        className="mx-auto block h-auto w-full max-w-[300px]"
        role="img"
        aria-label="Ear anatomy"
      >
        <defs>
          <linearGradient id="earFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(154,174,181,0.32)" />
            <stop offset="100%" stopColor="rgba(154,174,181,0.18)" />
          </linearGradient>
        </defs>

        {/* Stylised face profile (right-facing) */}
        <path
          d="M40 12 Q92 16 100 60 Q108 90 100 120 Q98 152 80 174 Q68 188 50 192"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1.4}
          strokeLinecap="round"
        />

        {/* Reference vertical for projection */}
        <line
          x1={130}
          y1={60}
          x2={130}
          y2={170}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />

        <g transform={`translate(${earOffsetX}, 0)`}>
          {/* Outer helix */}
          <path
            d="M138 70
               C172 70 188 96 184 130
               C182 158 162 174 138 172
               C128 170 124 162 124 150
               L124 90
               C124 78 130 70 138 70 Z"
            fill="url(#earFill)"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />

          {/* Antihelix curve */}
          <path
            d="M138 86
               C158 88 170 110 168 138
               C166 156 152 162 142 158"
            fill="none"
            stroke={`rgba(255,255,255,${antihelixAlpha})`}
            strokeWidth={1.6}
            strokeLinecap="round"
          />

          {/* Concha (inner basin) */}
          <ellipse
            cx={144}
            cy={130}
            rx={12}
            ry={20}
            fill="rgba(0,0,0,0.22)"
          />

          {/* Tragus */}
          <path
            d="M132 124 Q126 130 132 138 Z"
            fill="rgba(255,255,255,0.45)"
          />

          {/* Earlobe */}
          <path
            d="M134 158 Q146 168 154 170 Q156 178 144 180 Q132 178 130 170 Z"
            fill={`rgba(154,174,181,${0.25 + (cart / 10) * 0.25})`}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.2}
          />
        </g>

        {/* Symmetry indicator dot */}
        {symmetry !== null ? (
          <circle
            cx={130 + earOffsetX}
            cy={120}
            r={3}
            fill={
              bandFromScore(symmetry) === "excellent"
                ? "#86efac"
                : bandFromScore(symmetry) === "good"
                  ? "#bef264"
                  : bandFromScore(symmetry) === "moderate"
                    ? "#fcd34d"
                    : "#fca5a5"
            }
          />
        ) : null}
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-white/40" />
          {i18n(language, { en: "Helix", fr: "Hélix" })}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-4 rounded-sm"
            style={{ backgroundColor: `rgba(255,255,255,${antihelixAlpha})` }}
          />
          {i18n(language, { en: "Antihelix", fr: "Antihélix" })}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-black/40" />
          {i18n(language, { en: "Concha", fr: "Conque" })}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Earlobe shape gallery — attached / free / pointed
 * ------------------------------------------------------------------------- */

type LobeShape = "attached" | "free" | "pointed" | "broad";

const LOBE_SHAPES: {
  key: LobeShape;
  label: { en: string; fr: string };
  draw: (active: boolean) => React.ReactNode;
}[] = [
  {
    key: "attached",
    label: { en: "Attached", fr: "Attaché" },
    draw: (active) => (
      <path
        d="M30 10 Q50 6 70 10 L70 56 Q50 70 30 56 Z"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.2}
      />
    ),
  },
  {
    key: "free",
    label: { en: "Free", fr: "Détaché" },
    draw: (active) => (
      <>
        <path
          d="M30 10 Q50 6 70 10 L70 46"
          fill="none"
          stroke={
            active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
          }
          strokeWidth={1.2}
        />
        <ellipse
          cx={50}
          cy={56}
          rx={18}
          ry={10}
          fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
          stroke={
            active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
          }
          strokeWidth={1.2}
        />
      </>
    ),
  },
  {
    key: "pointed",
    label: { en: "Pointed", fr: "Pointu" },
    draw: (active) => (
      <path
        d="M30 10 Q50 6 70 10 L66 50 L50 70 L34 50 Z"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.2}
      />
    ),
  },
  {
    key: "broad",
    label: { en: "Broad", fr: "Large" },
    draw: (active) => (
      <path
        d="M30 10 Q50 6 70 10 L74 50 Q50 70 26 50 Z"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.2}
      />
    ),
  },
];

const LOBE_ALIASES: Record<string, LobeShape> = {
  attached: "attached",
  fused: "attached",
  attaché: "attached",
  attache: "attached",
  free: "free",
  detached: "free",
  unattached: "free",
  détaché: "free",
  detache: "free",
  pointed: "pointed",
  pointu: "pointed",
  v_shape: "pointed",
  broad: "broad",
  large: "broad",
  wide: "broad",
};

function normalizeLobe(value: string | null): LobeShape | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return LOBE_ALIASES[k] ?? null;
}

function LobeGallery({
  selected,
  language,
}: {
  selected: LobeShape | null;
  language: AppLanguage;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {LOBE_SHAPES.map((shape) => {
        const isActive = shape.key === selected;
        return (
          <div
            key={shape.key}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
              isActive
                ? "border-white/45 bg-white/[0.08] shadow-[0_0_28px_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <svg viewBox="0 0 100 80" className="h-16 w-20" role="img">
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
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface EarWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function EarWorkerView({ aggregates, language }: EarWorkerViewProps) {
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

  const overall = getScore(aggregates, "overall_ear");

  // Proportions & placement
  const sizeHarmony = getScore(
    aggregates,
    "proportions_and_placement.size_harmony",
  );
  const vertical = getScore(
    aggregates,
    "proportions_and_placement.vertical_placement",
  );
  const axisTilt = getScore(aggregates, "proportions_and_placement.axis_tilt");

  // Projection & frontal
  const projection = getScore(
    aggregates,
    "projection_and_frontal.ear_projection",
  );
  const cartilage = getScore(
    aggregates,
    "projection_and_frontal.cartilage_architecture",
  );

  // Morphology
  const symmetry = getScore(aggregates, "morphology.ear_symmetry");
  const helixEnum = getEnum(aggregates, "morphology.helix_contour");
  const lobeEnum = getEnum(aggregates, "morphology.earlobe_shape");
  const lobeKey = normalizeLobe(lobeEnum.value);

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Ears", fr: "Oreilles" })}
        title={i18n(language, {
          en: "Your ear signature",
          fr: "Ta signature des oreilles",
        })}
        argument={overall.argument}
        score={overall.score}
        rightSlot={
          lobeEnum.value ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Earlobe", fr: "Lobe" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {formatEnumValue("morphology.earlobe_shape", lobeEnum.value) ??
                  lobeEnum.value}
              </p>
            </div>
          ) : null
        }
      />

      {/* Anatomy */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Anatomy", fr: "Anatomie" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Helix × antihelix × concha",
                  fr: "Hélix × antihélix × conque",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "The ear shifts away from the skull as your projection grows. The antihelix darkens with cartilage definition, and the symmetry dot reflects how mirrored your two ears read.",
                  fr: "L'oreille s'écarte du crâne avec la projection. L'antihélix s'assombrit avec la définition du cartilage, et le point de symétrie reflète à quel point tes deux oreilles se correspondent.",
                })}
              </p>
            </div>
            <EarAnatomy
              projection={projection.score}
              cartilage={cartilage.score}
              symmetry={symmetry.score}
              language={language}
            />
          </div>
        </CardContent>
      </Card>

      {/* Earlobe gallery */}
      {lobeEnum.value ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Earlobe shape", fr: "Forme du lobe" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Where your lobe sits",
                  fr: "Où se situe ton lobe",
                })}
              </h3>
              {lobeEnum.argument ? (
                <p className="text-sm leading-relaxed text-zinc-400">
                  {lobeEnum.argument}
                </p>
              ) : null}
            </div>
            <LobeGallery selected={lobeKey} language={language} />
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Proportions & placement",
            fr: "Proportions et placement",
          })}
          title={i18n(language, {
            en: "Size & axis",
            fr: "Taille et axe",
          })}
        >
          <ScoreBar
            label={formatLabel("proportions_and_placement.size_harmony")}
            score={sizeHarmony.score}
            argument={sizeHarmony.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("proportions_and_placement.vertical_placement")}
            score={vertical.score}
            argument={vertical.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("proportions_and_placement.axis_tilt")}
            score={axisTilt.score}
            argument={axisTilt.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Projection & cartilage",
            fr: "Projection et cartilage",
          })}
          title={i18n(language, {
            en: "Distance & architecture",
            fr: "Distance et architecture",
          })}
        >
          <ScoreBar
            label={formatLabel("projection_and_frontal.ear_projection")}
            score={projection.score}
            argument={projection.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("projection_and_frontal.cartilage_architecture")}
            score={cartilage.score}
            argument={cartilage.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Morphology", fr: "Morphologie" })}
          title={i18n(language, {
            en: "Symmetry & helix",
            fr: "Symétrie et hélix",
          })}
        >
          <ScoreBar
            label={formatLabel("morphology.ear_symmetry")}
            score={symmetry.score}
            argument={symmetry.argument}
            language={language}
          />
          {helixEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("morphology.helix_contour")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue("morphology.helix_contour", helixEnum.value)}
                </span>
              </div>
              {helixEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {helixEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>
      </div>
    </div>
  );
}
