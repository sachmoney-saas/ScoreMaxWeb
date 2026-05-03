import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  getEnum,
  getScore,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "eyes";

/* ----------------------------------------------------------------------------
 * Eye shape gallery
 *
 * Stylised SVG of each canonical eye shape on a 100x40 canvas.
 * ------------------------------------------------------------------------- */

type EyeShape =
  | "almond"
  | "round"
  | "hooded"
  | "monolid"
  | "downturned"
  | "deep_set";

const EYE_SHAPES: {
  key: EyeShape;
  label: { en: string; fr: string };
  /** Outer eyelid path 100x40, opening shape and pupil rendered separately. */
  draw: (active: boolean) => React.ReactNode;
}[] = [
  {
    key: "almond",
    label: { en: "Almond", fr: "Amande" },
    draw: (active) => (
      <>
        <path
          d="M8 22 Q50 6 92 22 Q50 36 8 22 Z"
          fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
          stroke={active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)"}
          strokeWidth={1}
        />
        <circle cx={50} cy={22} r={6} fill="#0e1418" />
        <circle cx={50} cy={22} r={3} fill="#3a4a52" />
      </>
    ),
  },
  {
    key: "round",
    label: { en: "Round", fr: "Ronds" },
    draw: (active) => (
      <>
        <ellipse
          cx={50}
          cy={22}
          rx={20}
          ry={14}
          fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
          stroke={active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)"}
          strokeWidth={1}
        />
        <circle cx={50} cy={22} r={7} fill="#0e1418" />
        <circle cx={50} cy={22} r={3} fill="#3a4a52" />
      </>
    ),
  },
  {
    key: "hooded",
    label: { en: "Hooded", fr: "Tombants" },
    draw: (active) => (
      <>
        {/* hood */}
        <path
          d="M6 14 Q50 18 94 14 Q50 24 6 14 Z"
          fill="rgba(154,174,181,0.18)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={0.6}
        />
        {/* eye */}
        <path
          d="M14 24 Q50 14 86 24 Q50 32 14 24 Z"
          fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
          stroke={active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)"}
          strokeWidth={1}
        />
        <circle cx={50} cy={24} r={5} fill="#0e1418" />
      </>
    ),
  },
  {
    key: "monolid",
    label: { en: "Monolid", fr: "Monopaupière" },
    draw: (active) => (
      <>
        <path
          d="M8 22 Q50 18 92 22 Q50 30 8 22 Z"
          fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
          stroke={active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)"}
          strokeWidth={1}
        />
        <circle cx={50} cy={22} r={4.5} fill="#0e1418" />
      </>
    ),
  },
  {
    key: "downturned",
    label: { en: "Downturned", fr: "Tombants" },
    draw: (active) => (
      <>
        <path
          d="M8 16 Q50 8 92 28 Q50 34 8 24 Z"
          fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
          stroke={active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)"}
          strokeWidth={1}
        />
        <circle cx={48} cy={22} r={5.5} fill="#0e1418" />
      </>
    ),
  },
  {
    key: "deep_set",
    label: { en: "Deep-set", fr: "Enfoncés" },
    draw: (active) => (
      <>
        {/* brow shadow */}
        <rect
          x={4}
          y={6}
          width={92}
          height={10}
          rx={4}
          fill="rgba(154,174,181,0.22)"
        />
        <path
          d="M14 24 Q50 14 86 24 Q50 32 14 24 Z"
          fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
          stroke={active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)"}
          strokeWidth={1}
        />
        <circle cx={50} cy={24} r={5} fill="#0e1418" />
      </>
    ),
  },
];

const EYE_SHAPE_ALIASES: Record<string, EyeShape> = {
  almond: "almond",
  amande: "almond",
  round: "round",
  ronds: "round",
  rounded: "round",
  hooded: "hooded",
  tombants: "hooded",
  monolid: "monolid",
  monopaupière: "monolid",
  monopaupiere: "monolid",
  downturned: "downturned",
  deep_set: "deep_set",
  "deep set": "deep_set",
  enfoncés: "deep_set",
  enfonces: "deep_set",
};

function normalizeEyeShape(value: string | null): EyeShape | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return EYE_SHAPE_ALIASES[k] ?? null;
}

function EyeShapeGallery({
  selected,
  language,
}: {
  selected: EyeShape | null;
  language: AppLanguage;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {EYE_SHAPES.map((shape) => {
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
            <svg
              viewBox="0 0 100 40"
              className="h-10 w-24"
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
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Canthal tilt indicator
 * ------------------------------------------------------------------------- */

type CanthalTilt = "negative" | "neutral" | "positive";

const CANTHAL_ALIASES: Record<string, CanthalTilt> = {
  positive: "positive",
  upward: "positive",
  upturned: "positive",
  positif: "positive",
  neutral: "neutral",
  zero: "neutral",
  flat: "neutral",
  neutre: "neutral",
  negative: "negative",
  downward: "negative",
  downturned: "negative",
  négatif: "negative",
  negatif: "negative",
};

function normalizeCanthal(value: string | null): CanthalTilt | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return CANTHAL_ALIASES[k] ?? null;
}

function CanthalTiltVisual({
  tilt,
  language,
}: {
  tilt: CanthalTilt | null;
  language: AppLanguage;
}) {
  const items: { key: CanthalTilt; label: { en: string; fr: string }; angle: number }[] = [
    { key: "negative", label: { en: "Negative", fr: "Négatif" }, angle: 12 },
    { key: "neutral", label: { en: "Neutral", fr: "Neutre" }, angle: 0 },
    { key: "positive", label: { en: "Positive", fr: "Positif" }, angle: -12 },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => {
        const isActive = item.key === tilt;
        const inner = 18; // inner canthus y
        const outer = 18 + Math.sin((item.angle * Math.PI) / 180) * 14;
        return (
          <div
            key={item.key}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
              isActive
                ? "border-white/45 bg-white/[0.08]"
                : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <svg viewBox="0 0 100 36" className="h-8 w-24" role="img">
              <path
                d={`M10 ${outer} Q50 ${(inner + outer) / 2 - 8} 90 ${inner} Q50 ${(inner + outer) / 2 + 8} 10 ${outer} Z`}
                fill={
                  isActive ? "rgba(233,241,244,0.9)" : "rgba(154,174,181,0.4)"
                }
                stroke={
                  isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.2)"
                }
                strokeWidth={1}
              />
              <circle cx={50} cy={(inner + outer) / 2} r={4} fill="#0e1418" />
            </svg>
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
                isActive ? "text-white" : "text-zinc-500"
              }`}
            >
              {i18n(language, item.label)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Iris color palette (reused from coloring inspiration)
 * ------------------------------------------------------------------------- */

const IRIS_COLOR_PALETTE: { value: string; color: string }[] = [
  { value: "black", color: "#1a1413" },
  { value: "dark_brown", color: "#3a261a" },
  { value: "medium_brown", color: "#6a4528" },
  { value: "light_brown", color: "#a06f43" },
  { value: "hazel", color: "#9a7a3f" },
  { value: "green", color: "#4f7d4f" },
  { value: "blue_grey", color: "#7488a0" },
  { value: "blue", color: "#3d6a9c" },
  { value: "light_blue", color: "#7cb1d6" },
];

function IrisSwatch({
  selected,
  label,
  valueLabel,
  argument,
}: {
  selected: string | null;
  label: string;
  valueLabel: string | null;
  argument: string | null;
}) {
  const idx = selected
    ? IRIS_COLOR_PALETTE.findIndex(
        (p) => p.value === selected.toLowerCase().replace(/\s+/g, "_"),
      )
    : -1;
  const total = IRIS_COLOR_PALETTE.length;
  const pct = idx >= 0 ? ((idx + 0.5) / total) * 100 : null;
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        {valueLabel ? (
          <span className="text-sm font-semibold text-white">{valueLabel}</span>
        ) : (
          <span className="text-xs font-medium text-zinc-500">—</span>
        )}
      </div>
      <div className="relative h-9 w-full overflow-hidden rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex h-full w-full">
          {IRIS_COLOR_PALETTE.map((p) => (
            <div
              key={p.value}
              className="h-full flex-1"
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
        {pct !== null ? (
          <div
            className="pointer-events-none absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
            style={{ left: `${pct}%` }}
          />
        ) : null}
      </div>
      {argument ? (
        <p className="text-xs leading-relaxed text-zinc-400">{argument}</p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Spacing axis — Close-set ↔ Wide-set
 * ------------------------------------------------------------------------- */

type SpacingKey = "close_set" | "balanced" | "wide_set";

const SPACING_ALIASES: Record<string, SpacingKey> = {
  close_set: "close_set",
  close: "close_set",
  rapprochés: "close_set",
  rapproches: "close_set",
  narrow: "close_set",
  balanced: "balanced",
  ideal: "balanced",
  neutral: "balanced",
  équilibré: "balanced",
  equilibre: "balanced",
  wide_set: "wide_set",
  wide: "wide_set",
  écartés: "wide_set",
  ecartes: "wide_set",
};

function normalizeSpacing(value: string | null): SpacingKey | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return SPACING_ALIASES[k] ?? null;
}

function SpacingAxis({
  spacing,
  language,
}: {
  spacing: SpacingKey | null;
  language: AppLanguage;
}) {
  const positions: { key: SpacingKey; label: { en: string; fr: string }; gap: number }[] = [
    { key: "close_set", label: { en: "Close-set", fr: "Rapprochés" }, gap: 14 },
    { key: "balanced", label: { en: "Balanced", fr: "Équilibrés" }, gap: 26 },
    { key: "wide_set", label: { en: "Wide-set", fr: "Écartés" }, gap: 40 },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {positions.map((p) => {
        const isActive = p.key === spacing;
        return (
          <div
            key={p.key}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
              isActive
                ? "border-white/45 bg-white/[0.08]"
                : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <svg viewBox="0 0 100 36" className="h-8 w-24" role="img">
              <ellipse
                cx={50 - p.gap}
                cy={18}
                rx={9}
                ry={5}
                fill={
                  isActive ? "rgba(233,241,244,0.9)" : "rgba(154,174,181,0.4)"
                }
                stroke={
                  isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.2)"
                }
                strokeWidth={1}
              />
              <ellipse
                cx={50 + p.gap}
                cy={18}
                rx={9}
                ry={5}
                fill={
                  isActive ? "rgba(233,241,244,0.9)" : "rgba(154,174,181,0.4)"
                }
                stroke={
                  isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.2)"
                }
                strokeWidth={1}
              />
              <circle cx={50 - p.gap} cy={18} r={2.5} fill="#0e1418" />
              <circle cx={50 + p.gap} cy={18} r={2.5} fill="#0e1418" />
            </svg>
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
                isActive ? "text-white" : "text-zinc-500"
              }`}
            >
              {i18n(language, p.label)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface EyesWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function EyesWorkerView({ aggregates, language }: EyesWorkerViewProps) {
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

  const overall = getScore(aggregates, "overall_eye_score");

  // Morphology & tilt
  const shapeEnum = getEnum(aggregates, "morphology_and_tilt.eye_shape");
  const shapeKey = normalizeEyeShape(shapeEnum.value);
  const shapeDisplay = formatEnumValue("morphology_and_tilt.eye_shape", shapeEnum.value);
  const canthalEnum = getEnum(aggregates, "morphology_and_tilt.canthal_tilt");
  const canthalKey = normalizeCanthal(canthalEnum.value);
  const spacingEnum = getEnum(aggregates, "morphology_and_tilt.eye_spacing");
  const spacingKey = normalizeSpacing(spacingEnum.value);
  const orbitalEnum = getEnum(aggregates, "morphology_and_tilt.orbital_depth");
  const eyeSym = getScore(aggregates, "morphology_and_tilt.eye_symmetry");

  // Eyelids & sclera
  const upperLid = getScore(aggregates, "eyelids_and_sclera.upper_eyelid_exposure");
  const lowerSclera = getScore(aggregates, "eyelids_and_sclera.lower_scleral_show");
  const epiEnum = getEnum(aggregates, "eyelids_and_sclera.epicanthic_fold");

  // Under-eye
  const support = getScore(aggregates, "under_eye_health.support_and_hollows");
  const pigmentation = getScore(aggregates, "under_eye_health.pigmentation");

  // Details & color
  const sclera = getScore(aggregates, "details_and_color.sclera_clarity");
  const limbalEnum = getEnum(aggregates, "details_and_color.limbal_ring_visibility");
  const lashes = getScore(aggregates, "details_and_color.eyelash_density");
  const irisEnum = getEnum(aggregates, "details_and_color.iris_color");

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Eyes",
          fr: "Yeux",
        })}
        title={i18n(language, {
          en: "Your eye signature",
          fr: "Ta signature oculaire",
        })}
        argument={overall.argument}
        score={overall.score}
        rightSlot={
          shapeDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Eye shape", fr: "Forme des yeux" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {shapeDisplay}
              </p>
            </div>
          ) : null
        }
      />

      {/* Eye shape gallery */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, {
                en: "Morphology",
                fr: "Morphologie",
              })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Where your eye sits",
                fr: "Où se situe ton œil",
              })}
            </h3>
            {shapeEnum.argument ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                {shapeEnum.argument}
              </p>
            ) : null}
          </div>
          <EyeShapeGallery selected={shapeKey} language={language} />
        </CardContent>
      </Card>

      {/* Canthal tilt + spacing */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Canthal tilt", fr: "Inclinaison canthale" })}
              </p>
              <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-white">
                {i18n(language, {
                  en: "Outer-corner angle",
                  fr: "Angle du coin externe",
                })}
              </h3>
            </div>
            <CanthalTiltVisual tilt={canthalKey} language={language} />
            {canthalEnum.argument ? (
              <p className="text-xs leading-relaxed text-zinc-400">
                {canthalEnum.argument}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Eye spacing", fr: "Espacement des yeux" })}
              </p>
              <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-white">
                {i18n(language, {
                  en: "Distance between the eyes",
                  fr: "Distance entre les yeux",
                })}
              </h3>
            </div>
            <SpacingAxis spacing={spacingKey} language={language} />
            {spacingEnum.argument ? (
              <p className="text-xs leading-relaxed text-zinc-400">
                {spacingEnum.argument}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Iris swatch */}
      {irisEnum.value ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Iris color", fr: "Couleur de l'iris" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Where your iris falls",
                  fr: "Où se situe ton iris",
                })}
              </h3>
            </div>
            <IrisSwatch
              selected={irisEnum.value}
              label={formatLabel("details_and_color.iris_color")}
              valueLabel={formatEnumValue("details_and_color.iris_color", irisEnum.value)}
              argument={irisEnum.argument}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Eyelids & sclera",
            fr: "Paupières et sclère",
          })}
          title={i18n(language, {
            en: "Lid exposure & whites",
            fr: "Paupières et blanc",
          })}
        >
          <ScoreBar
            label={formatLabel("eyelids_and_sclera.upper_eyelid_exposure")}
            score={upperLid.score}
            argument={upperLid.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("eyelids_and_sclera.lower_scleral_show")}
            score={lowerSclera.score}
            argument={lowerSclera.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("morphology_and_tilt.eye_symmetry")}
            score={eyeSym.score}
            argument={eyeSym.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Under-eye health",
            fr: "Santé sous les yeux",
          })}
          title={i18n(language, {
            en: "Support & pigmentation",
            fr: "Support et pigmentation",
          })}
        >
          <ScoreBar
            label={formatLabel("under_eye_health.support_and_hollows")}
            score={support.score}
            argument={support.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("under_eye_health.pigmentation")}
            score={pigmentation.score}
            argument={pigmentation.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Color details",
            fr: "Détails couleur",
          })}
          title={i18n(language, {
            en: "Sclera & lashes",
            fr: "Sclère et cils",
          })}
        >
          <ScoreBar
            label={formatLabel("details_and_color.sclera_clarity")}
            score={sclera.score}
            argument={sclera.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("details_and_color.eyelash_density")}
            score={lashes.score}
            argument={lashes.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Architecture",
            fr: "Architecture",
          })}
          title={i18n(language, {
            en: "Folds & depth",
            fr: "Plis et profondeur",
          })}
        >
          {orbitalEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("morphology_and_tilt.orbital_depth")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "morphology_and_tilt.orbital_depth",
                    orbitalEnum.value,
                  )}
                </span>
              </div>
              {orbitalEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {orbitalEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
          {epiEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("eyelids_and_sclera.epicanthic_fold")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "eyelids_and_sclera.epicanthic_fold",
                    epiEnum.value,
                  )}
                </span>
              </div>
              {epiEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {epiEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
          {limbalEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("details_and_color.limbal_ring_visibility")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "details_and_color.limbal_ring_visibility",
                    limbalEnum.value,
                  )}
                </span>
              </div>
              {limbalEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {limbalEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>
      </div>
    </div>
  );
}
