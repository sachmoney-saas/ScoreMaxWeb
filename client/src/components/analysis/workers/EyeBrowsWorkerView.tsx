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
import { cn } from "@/lib/utils";
import {
  getEnum,
  getScore,
  hasAnyScore,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "eye_brows";

/* ----------------------------------------------------------------------------
 * Eyebrow shape gallery
 *
 * Each card draws a stylised brow on a 100x40 canvas.
 * ------------------------------------------------------------------------- */

type BrowShape = "straight" | "soft_arch" | "high_arch" | "rounded";

const BROW_SHAPES: {
  key: BrowShape;
  label: { en: string; fr: string };
  /** Path for the upper edge of the brow on a 100x40 canvas. */
  upper: string;
  /** Path for the lower edge that we fill to form the brow body. */
  lower: string;
}[] = [
  {
    key: "straight",
    label: { en: "Straight", fr: "Droit" },
    upper: "M6 22 L94 18",
    lower: "L94 26 L6 30 Z",
  },
  {
    key: "soft_arch",
    label: { en: "Soft arch", fr: "Arc doux" },
    upper: "M6 26 Q50 8 94 22",
    lower: "L94 30 Q50 16 6 32 Z",
  },
  {
    key: "high_arch",
    label: { en: "High arch", fr: "Arc haut" },
    upper: "M6 30 Q42 4 60 14 Q80 22 94 22",
    lower: "L94 30 Q80 28 60 22 Q42 12 6 34 Z",
  },
  {
    key: "rounded",
    label: { en: "Rounded", fr: "Arrondi" },
    upper: "M6 26 Q50 12 94 26",
    lower: "L94 32 Q50 20 6 32 Z",
  },
];

const BROW_SHAPE_ALIASES: Record<string, BrowShape> = {
  straight: "straight",
  droit: "straight",
  flat: "straight",
  soft_arch: "soft_arch",
  "soft arch": "soft_arch",
  arched: "soft_arch",
  arc_doux: "soft_arch",
  high_arch: "high_arch",
  "high arch": "high_arch",
  arc_haut: "high_arch",
  rounded: "rounded",
  arrondi: "rounded",
  curved: "rounded",
};

function normalizeBrowShape(value: string | null): BrowShape | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return BROW_SHAPE_ALIASES[k] ?? null;
}

function BrowShapeGallery({
  selected,
  language,
  taxonomyAnchorId,
}: {
  selected: BrowShape | null;
  language: AppLanguage;
  taxonomyAnchorId: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {BROW_SHAPES.map((shape) => {
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
              viewBox="0 0 100 40"
              className="h-10 w-24"
              role="img"
              aria-label={shape.label.en}
            >
              <path
                d={`${shape.upper} ${shape.lower}`}
                fill={
                  isActive ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"
                }
                stroke={
                  isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)"
                }
                strokeWidth={1}
                strokeLinejoin="round"
              />
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
 * Bold × Feminine matrix
 *
 * X axis: Feminine ← → Masculine (derived from arch type + thickness)
 * Y axis: Bold (top) ← → Subtle (bottom) (derived from thickness + density)
 * ------------------------------------------------------------------------- */

function BoldFeminineMatrix({
  thickness,
  density,
  archScore,
  language,
  cellTargetId,
}: {
  thickness: number | null;
  density: number | null;
  archScore: number | null;
  language: AppLanguage;
  /** Scroll target for matrix cells (sans `#`). */
  cellTargetId?: string;
}) {
  const cols = 7;
  const rows = 7;

  // Bold axis (Y): combine thickness + density. High = bold (top).
  const boldSignals = [thickness, density].filter(
    (v): v is number => v !== null,
  );
  const boldness =
    boldSignals.length > 0
      ? boldSignals.reduce((a, b) => a + b, 0) / boldSignals.length
      : null;

  // Y inverted: bold (high) → top (row 0)
  const yIdx =
    boldness !== null
      ? Math.min(
          rows - 1,
          Math.max(0, Math.round(((10 - boldness) / 10) * (rows - 1))),
        )
      : null;

  // Feminine axis (X): high arch + lower thickness = feminine.
  // archScore is "0..10 ~ flat..high arch" — used as feminine proxy.
  // We then offset by thickness (the thicker, the more masculine).
  let femScore: number | null = null;
  if (archScore !== null || thickness !== null) {
    const arch = archScore ?? 5;
    const th = thickness ?? 5;
    // Higher arch + thinner brow → more feminine. Range ~0..10
    const raw = arch * 0.6 + (10 - th) * 0.4;
    femScore = Math.max(0, Math.min(10, raw));
  }

  // X: feminine on left (col 0), masculine on right (col cols-1)
  const xIdx =
    femScore !== null
      ? Math.min(
          cols - 1,
          Math.max(0, Math.round(((10 - femScore) / 10) * (cols - 1))),
        )
      : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[60px_1fr_60px] grid-rows-[24px_1fr_24px] items-center gap-1">
        {/* top label */}
        <div />
        <div className="text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {i18n(language, { en: "Bold", fr: "Marqué" })}
        </div>
        <div />

        {/* left label */}
        <div className="text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {i18n(language, { en: "Feminine", fr: "Féminin" })}
        </div>

        {/* matrix grid */}
        <div
          className="relative aspect-square w-full rounded-2xl border border-white/10 bg-white/[0.03] p-2"
          role="img"
          aria-label="Bold × Feminine matrix"
        >
          <div
            className="grid h-full w-full gap-1"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: rows }).map((_, ry) =>
              Array.from({ length: cols }).map((_, cx) => {
                const isUser = xIdx === cx && yIdx === ry;
                const distance = Math.hypot(
                  cx - (cols - 1) / 2,
                  ry - (rows - 1) / 2,
                );
                const baseOpacity = Math.max(0.04, 0.18 - distance * 0.025);
                const bg = isUser
                  ? "#e9f1f4"
                  : (`rgba(154,174,181,${baseOpacity})` as string);
                const sh = isUser
                  ? "0 0 18px rgba(255,255,255,0.55)"
                  : undefined;
                const c = cn(
                  "rounded-md transition",
                  isUser && "ring-2 ring-white/80",
                  cellTargetId &&
                    "cursor-pointer hover:brightness-125 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35",
                );
                if (!cellTargetId) {
                  return (
                    <div
                      key={`cell-${ry}-${cx}`}
                      className={c}
                      style={{
                        backgroundColor: bg,
                        boxShadow: sh,
                      }}
                    />
                  );
                }
                return (
                  <button
                    key={`cell-${ry}-${cx}`}
                    type="button"
                    className={cn(c, "h-full min-h-0 w-full border-0 p-0")}
                    style={{
                      backgroundColor: bg,
                      boxShadow: sh,
                    }}
                    aria-label={i18n(language, {
                      en: "Go to density and grooming scores",
                      fr: "Aller aux scores densité et toilettage",
                    })}
                    onClick={() => scrollToWorkerAnchor(cellTargetId)}
                  />
                );
              }),
            )}
          </div>

          {/* axes */}
          <div className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-white/10" />
          <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/10" />
        </div>

        {/* right label */}
        <div className="text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {i18n(language, { en: "Masculine", fr: "Masculin" })}
        </div>

        {/* bottom label */}
        <div />
        <div className="text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {i18n(language, { en: "Subtle", fr: "Subtil" })}
        </div>
        <div />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Tilt indicator — small visual showing brow angle
 * ------------------------------------------------------------------------- */

type TiltKey = "negative" | "neutral" | "positive";

const TILT_ALIASES: Record<string, TiltKey> = {
  negative: "negative",
  downturned: "negative",
  downward: "negative",
  down: "negative",
  neutral: "neutral",
  straight: "neutral",
  flat: "neutral",
  positive: "positive",
  upturned: "positive",
  upward: "positive",
  up: "positive",
};

function normalizeTilt(value: string | null): TiltKey | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return TILT_ALIASES[k] ?? null;
}

function TiltIndicator({
  tilt,
  language,
  taxonomyAnchorId,
}: {
  tilt: TiltKey | null;
  language: AppLanguage;
  /** Carte « taxonomie » où inclinaison et forme sont expliquées */
  taxonomyAnchorId?: string;
}) {
  const items: { key: TiltKey; label: { en: string; fr: string }; angle: number }[] = [
    { key: "negative", label: { en: "Negative", fr: "Négative" }, angle: 14 },
    { key: "neutral", label: { en: "Neutral", fr: "Neutre" }, angle: 0 },
    { key: "positive", label: { en: "Positive", fr: "Positive" }, angle: -14 },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => {
        const isActive = item.key === tilt;
        const tileClass = cn(
          "flex flex-col items-center gap-2 rounded-2xl border p-3 transition",
          isActive
            ? "border-white/45 bg-white/[0.08]"
            : "border-white/10 bg-white/[0.025]",
          taxonomyAnchorId &&
            "cursor-pointer hover:border-white/25 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35",
        );
        const inner = (
          <>
            <svg viewBox="0 0 80 32" className="h-8 w-20" role="img">
              <line
                x1={6}
                y1={16 + Math.sin((item.angle * Math.PI) / 180) * 12}
                x2={74}
                y2={16 - Math.sin((item.angle * Math.PI) / 180) * 12}
                stroke={
                  isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.3)"
                }
                strokeWidth={4}
                strokeLinecap="round"
              />
            </svg>
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
                isActive ? "text-white" : "text-zinc-500"
              }`}
            >
              {i18n(language, item.label)}
            </span>
          </>
        );
        if (!taxonomyAnchorId) {
          return (
            <div key={item.key} className={tileClass}>
              {inner}
            </div>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => scrollToWorkerAnchor(taxonomyAnchorId)}
            className={cn(tileClass, "text-left")}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface EyeBrowsWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function EyeBrowsWorkerView({
  aggregates,
  language,
}: EyeBrowsWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );

  const overall = getScore(aggregates, "global_score.overall_brow_score");

  const elevation = getScore(
    aggregates,
    "placement_and_symmetry.eyebrow_elevation",
  );
  const symmetry = getScore(
    aggregates,
    "placement_and_symmetry.eyebrow_symmetry",
  );

  const tiltEnum = getEnum(aggregates, "geometry_and_shape.eyebrow_tilt");
  const tiltKey = normalizeTilt(tiltEnum.value);
  const shapeEnum = getEnum(aggregates, "geometry_and_shape.eyebrow_shape");
  const shapeKey = normalizeBrowShape(shapeEnum.value);
  const shapeDisplay = shapeEnum.value
    ? formatAggregateDisplayValue(
        WORKER_KEY,
        "geometry_and_shape.eyebrow_shape",
        shapeEnum.value,
        locale,
      )
    : null;
  const tailLength = getScore(
    aggregates,
    "geometry_and_shape.tail_length_and_direction",
  );
  const innerStartEnum = getEnum(
    aggregates,
    "geometry_and_shape.inner_start_shape",
  );

  const thickness = getScore(
    aggregates,
    "density_grooming_and_glabella.eyebrow_thickness",
  );
  const density = getScore(
    aggregates,
    "density_grooming_and_glabella.eyebrow_density",
  );
  const glabellarHair = getScore(
    aggregates,
    "density_grooming_and_glabella.glabellar_hair",
  );
  const groomingEnum = getEnum(
    aggregates,
    "density_grooming_and_glabella.grooming_quality",
  );
  const browColorEnum = getEnum(
    aggregates,
    "density_grooming_and_glabella.brow_color",
  );

  // Arch score is a synthetic signal for the matrix (0=flat, 10=high arch)
  const archScore = (() => {
    if (!shapeKey) return null;
    if (shapeKey === "straight") return 1;
    if (shapeKey === "rounded") return 4;
    if (shapeKey === "soft_arch") return 6;
    if (shapeKey === "high_arch") return 9;
    return null;
  })();

  const browTaxonomyAnchor = workerSectionAnchorId(WORKER_KEY, "brow-taxonomy");
  const densitySectionAnchor = workerSectionAnchorId(WORKER_KEY, "density-grooming");

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Eyebrow design",
          fr: "Dessin des sourcils",
        })}
        title={i18n(language, {
          en: "Your brow signature",
          fr: "Ta signature de sourcils",
        })}
        argument={overall.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={
          shapeDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Brow shape", fr: "Forme du sourcil" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {shapeDisplay}
              </p>
            </div>
          ) : null
        }
      />

      {/* Bold × Feminine matrix */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, {
                  en: "Brow design matrix",
                  fr: "Matrice de design",
                })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Bold × Feminine register",
                  fr: "Registre Marqué × Féminin",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "Two faces with similar brow density can read very differently. The matrix combines thickness, density and arch to place your brow on the bold-vs-subtle and feminine-vs-masculine axes.",
                  fr: "Deux visages avec une densité de sourcils similaire peuvent rendre très différemment. La matrice combine épaisseur, densité et arc pour positionner ton sourcil sur les axes marqué/subtil et féminin/masculin.",
                })}
              </p>
            </div>
            <BoldFeminineMatrix
              thickness={thickness.score}
              density={density.score}
              archScore={archScore}
              language={language}
              cellTargetId={densitySectionAnchor}
            />
          </div>
        </CardContent>
      </Card>

      <Card
        id={browTaxonomyAnchor}
        className={`${workerSectionCardClassName} scroll-mt-28 sm:scroll-mt-32`}
      >
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, {
                en: "Brow taxonomy",
                fr: "Taxonomie des sourcils",
              })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Where your shape sits",
                fr: "Où se situe ta forme",
              })}
            </h3>
            {shapeEnum.argument ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                {shapeEnum.argument}
              </p>
            ) : null}
          </div>
          <BrowShapeGallery
            selected={shapeKey}
            language={language}
            taxonomyAnchorId={browTaxonomyAnchor}
          />

          {tiltEnum.value ? (
            <div className="space-y-3 border-t border-white/10 pt-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("geometry_and_shape.eyebrow_tilt")}
                </span>
              </div>
              <TiltIndicator
                tilt={tiltKey}
                language={language}
                taxonomyAnchorId={browTaxonomyAnchor}
              />
              {tiltEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {tiltEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(elevation.score, symmetry.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "placement-symmetry")}
          eyebrow={i18n(language, {
            en: "Placement & symmetry",
            fr: "Placement et symétrie",
          })}
          title={i18n(language, {
            en: "Frame around the eyes",
            fr: "Cadre autour des yeux",
          })}
        >
          <ScoreBar
            label={formatLabel("placement_and_symmetry.eyebrow_elevation")}
            score={elevation.score}
            argument={elevation.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "placement_and_symmetry.eyebrow_elevation",
            )}
          />
          <ScoreBar
            label={formatLabel("placement_and_symmetry.eyebrow_symmetry")}
            score={symmetry.score}
            argument={symmetry.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "placement_and_symmetry.eyebrow_symmetry",
            )}
          />
        </SectionShell>

        <SectionShell
          when={
            hasAnyScore(
              thickness.score,
              density.score,
              glabellarHair.score,
            ) ||
            Boolean(groomingEnum.value) ||
            Boolean(browColorEnum.value)
          }
          sectionId={densitySectionAnchor}
          eyebrow={i18n(language, {
            en: "Density, grooming & glabella",
            fr: "Densité, toilettage et glabelle",
          })}
          title={i18n(language, {
            en: "Volume and finish",
            fr: "Volume et finition",
          })}
        >
          <ScoreBar
            label={formatLabel("density_grooming_and_glabella.eyebrow_thickness")}
            score={thickness.score}
            argument={thickness.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "density_grooming_and_glabella.eyebrow_thickness",
            )}
          />
          <ScoreBar
            label={formatLabel("density_grooming_and_glabella.eyebrow_density")}
            score={density.score}
            argument={density.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "density_grooming_and_glabella.eyebrow_density",
            )}
          />
          <ScoreBar
            label={formatLabel("density_grooming_and_glabella.glabellar_hair")}
            score={glabellarHair.score}
            argument={glabellarHair.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "density_grooming_and_glabella.glabellar_hair",
            )}
          />
          {groomingEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("density_grooming_and_glabella.grooming_quality")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatAggregateDisplayValue(
                    WORKER_KEY,
                    "density_grooming_and_glabella.grooming_quality",
                    groomingEnum.value,
                    locale,
                  ) ?? groomingEnum.value}
                </span>
              </div>
              {groomingEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {groomingEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
          {browColorEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("density_grooming_and_glabella.brow_color")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatAggregateDisplayValue(
                    WORKER_KEY,
                    "density_grooming_and_glabella.brow_color",
                    browColorEnum.value,
                    locale,
                  ) ?? browColorEnum.value}
                </span>
              </div>
              {browColorEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {browColorEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>

        <SectionShell
          when={
            hasAnyScore(tailLength.score) || Boolean(innerStartEnum.value)
          }
          sectionId={workerSectionAnchorId(WORKER_KEY, "geometry-detail")}
          eyebrow={i18n(language, {
            en: "Geometry details",
            fr: "Détails géométriques",
          })}
          title={i18n(language, {
            en: "Tail & inner start",
            fr: "Queue et départ",
          })}
        >
          <ScoreBar
            label={formatLabel("geometry_and_shape.tail_length_and_direction")}
            score={tailLength.score}
            argument={tailLength.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "geometry_and_shape.tail_length_and_direction",
            )}
          />
          {innerStartEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("geometry_and_shape.inner_start_shape")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatAggregateDisplayValue(
                    WORKER_KEY,
                    "geometry_and_shape.inner_start_shape",
                    innerStartEnum.value,
                    locale,
                  ) ?? innerStartEnum.value}
                </span>
              </div>
              {innerStartEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {innerStartEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>
      </div>
    </div>
  );
}
