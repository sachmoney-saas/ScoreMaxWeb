import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { calculateWorkerFaceScore } from "@/lib/face-analysis-score";
import {
  scrollToWorkerAnchor,
  workerMetricAnchorId,
  workerSectionAnchorId,
} from "@/lib/worker-view-anchor";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  bandFromScore,
  getEnum,
  getScore,
  hasAnyScore,
  ScoreBar,
  SectionShell,
  WorkerHero,
  mergeHeroRightSlot,
  workerSectionCardClassName,
} from "./_shared";
import { AnalysisJobAssetPreviewThumb } from "./AnalysisJobAssetPreviewThumb";

const WORKER_KEY = "symmetry_shape";

/* ----------------------------------------------------------------------------
 * Face-shape gallery — étiquettes de la taxonomie (sans silhouettes SVG).
 * ------------------------------------------------------------------------- */

type FaceShapeKey =
  | "oval"
  | "round"
  | "square"
  | "heart"
  | "diamond"
  | "oblong";

const FACE_SHAPE_ORDER: FaceShapeKey[] = [
  "oval",
  "round",
  "square",
  "heart",
  "diamond",
  "oblong",
];

const FACE_SHAPE_LABELS: Record<FaceShapeKey, { en: string; fr: string }> = {
  oval: { en: "Oval", fr: "Ovale" },
  round: { en: "Round", fr: "Ronde" },
  square: { en: "Square", fr: "Carrée" },
  heart: { en: "Heart", fr: "Cœur" },
  diamond: { en: "Diamond", fr: "Diamant" },
  oblong: { en: "Oblong", fr: "Allongée" },
};

function normalizeShape(value: string | null): FaceShapeKey | null {
  if (!value) return null;
  const k = value.toLowerCase().trim();
  if (k === "long") return "oblong";
  if (k === "rectangle" || k === "rectangular") return "oblong";
  if ((FACE_SHAPE_ORDER as string[]).includes(k)) return k as FaceShapeKey;
  return null;
}

function FaceShapeGallery({
  selected,
  language,
  taxonomyAnchorId,
}: {
  selected: FaceShapeKey | null;
  language: AppLanguage;
  taxonomyAnchorId: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {FACE_SHAPE_ORDER.map((shape) => {
        const isActive = shape === selected;
        return (
          <button
            key={shape}
            type="button"
            onClick={() => scrollToWorkerAnchor(taxonomyAnchorId)}
            className={`relative flex min-h-[3.25rem] flex-col items-center justify-center rounded-2xl border px-2 py-2.5 text-center transition hover:border-white/25 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35 sm:min-h-[3.5rem] ${
              isActive
                ? "border-white/45 bg-white/[0.08] shadow-[0_0_28px_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
                isActive ? "text-white" : "text-zinc-500"
              }`}
            >
              {i18n(language, FACE_SHAPE_LABELS[shape])}
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
 * Bipolar (signed) ratio bar — ideal sits at the center, deviation in either
 * direction shifts the marker. Range expected: ~[-10..+10].
 * ------------------------------------------------------------------------- */

function bandFromAbs(score: number) {
  const a = Math.abs(score);
  if (a <= 1.5) return { color: "#86efac", text: "text-emerald-200", bg: "bg-emerald-400/15", label: { en: "Balanced", fr: "Équilibré" } };
  if (a <= 3.5) return { color: "#bef264", text: "text-lime-200", bg: "bg-lime-400/12", label: { en: "Slight", fr: "Léger" } };
  if (a <= 6) return { color: "#fcd34d", text: "text-amber-200", bg: "bg-amber-400/12", label: { en: "Moderate", fr: "Modéré" } };
  return { color: "#fca5a5", text: "text-rose-200", bg: "bg-rose-400/12", label: { en: "Strong", fr: "Fort" } };
}

function BipolarBar({
  label,
  leftLabel,
  rightLabel,
  score,
  argument,
  language,
  range = 10,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  score: number | null;
  argument: string | null;
  language: AppLanguage;
  range?: number;
}) {
  if (score === null) return null;
  const clamped = Math.max(-range, Math.min(range, score));
  const pct = ((clamped + range) / (2 * range)) * 100;
  const band = bandFromAbs(clamped);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <div className="flex items-baseline gap-3">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${band.bg} ${band.text}`}
          >
            {i18n(language, band.label)}
          </span>
          <span className="font-display text-base font-bold tabular-nums tracking-tight text-white">
            {clamped > 0 ? "+" : ""}
            {clamped.toFixed(clamped % 1 === 0 ? 0 : 1)}
          </span>
        </div>
      </div>

      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.08]">
        {/* center axis */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />

        {/* fill from center */}
        {clamped !== 0 ? (
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: clamped > 0 ? "50%" : `${pct}%`,
              right: clamped < 0 ? "50%" : `${100 - pct}%`,
              backgroundColor: band.color,
              opacity: 0.85,
            }}
          />
        ) : null}

        {/* marker */}
        <div
          className="pointer-events-none absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        <span>{leftLabel}</span>
        <span className="text-white/60">
          {i18n(language, { en: "Ideal", fr: "Idéal" })}
        </span>
        <span>{rightLabel}</span>
      </div>

      {argument ? (
        <p className="text-xs leading-relaxed text-zinc-400">{argument}</p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Miroir de symétrie — pastilles cliquables (sans schéma visage SVG).
 * ------------------------------------------------------------------------- */

function SymmetryMirror({
  regions,
  language,
}: {
  regions: {
    key: string;
    label: { en: string; fr: string };
    score: number | null;
    scrollTargetId: string;
  }[];
  language: AppLanguage;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
      {regions
        .filter((r): r is typeof r & { score: number } => r.score !== null)
        .map((r) => {
          const band = bandFromScore(r.score);
          const dotColor =
            band === "excellent"
              ? "bg-emerald-300"
              : band === "good"
                ? "bg-lime-300"
                : band === "moderate"
                  ? "bg-amber-300"
                  : "bg-rose-300";
          const ringColor =
            band === "excellent"
              ? "ring-emerald-300/40"
              : band === "good"
                ? "ring-lime-300/40"
                : band === "moderate"
                  ? "ring-amber-300/40"
                  : "ring-rose-300/40";
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => scrollToWorkerAnchor(r.scrollTargetId)}
              className={`cursor-pointer rounded-full bg-zinc-950/80 px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-white ring-1 backdrop-blur transition hover:brightness-125 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35 ${ringColor}`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                <span className="text-zinc-300">{i18n(language, r.label)}</span>
                <span className="font-display text-[11px] font-bold tabular-nums text-white">
                  {r.score.toFixed(r.score % 1 === 0 ? 0 : 1)}
                </span>
              </span>
            </button>
          );
        })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Proportions — repères scan tiers verticaux (gauche) + contour morphologique (droite).
 * ------------------------------------------------------------------------- */

function ProportionsCanvas({
  thirdsScore,
  fifthsScore,
  language,
  thirdsMetricId,
  fifthsMetricId,
  verticalThirdsAssetSrc,
  faceFrontShapeContourAssetSrc,
}: {
  thirdsScore: number | null;
  fifthsScore: number | null;
  language: AppLanguage;
  thirdsMetricId: string;
  fifthsMetricId: string;
  verticalThirdsAssetSrc?: string | null;
  faceFrontShapeContourAssetSrc?: string | null;
}) {
  const thirdsBand = thirdsScore !== null ? bandFromScore(thirdsScore) : null;
  const fifthsBand = fifthsScore !== null ? bandFromScore(fifthsScore) : null;
  const colorFor = (b: ReturnType<typeof bandFromScore> | null) =>
    !b
      ? "rgba(255,255,255,0.25)"
      : b === "excellent"
        ? "rgba(110,231,183,0.65)"
        : b === "good"
          ? "rgba(190,242,100,0.55)"
          : b === "moderate"
            ? "rgba(252,211,77,0.55)"
            : "rgba(252,165,165,0.55)";

  return (
    <div className="space-y-3">
      {(verticalThirdsAssetSrc ?? faceFrontShapeContourAssetSrc) ? (
        <div
          className="flex flex-wrap items-start justify-center gap-2 pb-1 pt-0.5 sm:gap-4"
          aria-label={i18n(language, {
            en: "Face scan guides: vertical thirds, shape contour",
            fr: "Repères scan : tiers verticaux, contour morphologique",
          })}
        >
          {verticalThirdsAssetSrc ? (
            <div className="flex shrink-0 justify-center">
              <AnalysisJobAssetPreviewThumb
                src={verticalThirdsAssetSrc}
                alt={i18n(language, {
                  en: "Front-face scan overlay: vertical-thirds guide lines",
                  fr: "Repère tiers verticaux sur ton visage (prise frontale)",
                })}
                imgFit="contain"
                className="w-fit max-w-[min(100%,220px)] shrink-0"
                imgClassName="max-h-52"
              />
            </div>
          ) : null}
          {faceFrontShapeContourAssetSrc ? (
            <div className="flex shrink-0 justify-center">
              <AnalysisJobAssetPreviewThumb
                src={faceFrontShapeContourAssetSrc}
                alt={i18n(language, {
                  en: "Front-face scan overlay: face shape contour guide",
                  fr: "Repère contour de la forme du visage (prise frontale)",
                })}
                imgFit="contain"
                className="w-fit max-w-[min(100%,220px)] shrink-0"
                imgClassName="max-h-52"
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-center gap-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        <button
          type="button"
          onClick={() => scrollToWorkerAnchor(thirdsMetricId)}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-1 py-0.5 transition hover:border-white/15 hover:text-zinc-200 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35"
        >
          <span
            className="h-2 w-4 rounded-sm"
            style={{ backgroundColor: colorFor(thirdsBand) }}
          />
          {i18n(language, { en: "Vertical thirds", fr: "Tiers verticaux" })}
        </button>
        <button
          type="button"
          onClick={() => scrollToWorkerAnchor(fifthsMetricId)}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-1 py-0.5 transition hover:border-white/15 hover:text-zinc-200 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35"
        >
          <span
            className="h-2 w-4 rounded-sm"
            style={{ backgroundColor: colorFor(fifthsBand) }}
          />
          {i18n(language, { en: "Horizontal fifths", fr: "Cinquièmes horizontaux" })}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface SymmetryShapeWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
  heroAside?: React.ReactNode;
  verticalThirdsAssetSrc?: string | null;
  faceFrontShapeContourAssetSrc?: string | null;
}

export function SymmetryShapeWorkerView({
  aggregates,
  language,
  heroAside,
  verticalThirdsAssetSrc,
  faceFrontShapeContourAssetSrc,
}: SymmetryShapeWorkerViewProps) {
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

  const faceTaxonomyAnchor = workerSectionAnchorId(WORKER_KEY, "face-taxonomy");
  const symUpperAnchor = workerSectionAnchorId(WORKER_KEY, "symmetry-upper");
  const symLowerAnchor = workerSectionAnchorId(WORKER_KEY, "symmetry-lower");

  const overallNested = getScore(
    aggregates,
    "global_score.overall_face_structure_score",
  );
  const overallFlat = getScore(aggregates, "overall_face_structure_score");
  const overallLegacy = getScore(aggregates, "overall_face_structure");
  const heroArgument =
    overallNested.argument ??
    overallFlat.argument ??
    overallLegacy.argument;

  // Shape
  const shapeEnum = getEnum(
    aggregates,
    "face_shape.overall_shape",
    "face_shape.shape",
  );
  const widthHierarchy = getEnum(aggregates, "face_shape.width_hierarchy");
  const shapeKey = normalizeShape(shapeEnum.value);
  const shapeDisplay = shapeEnum.value
    ? formatEnumValue("face_shape.overall_shape", shapeEnum.value)
    : null;

  // Symmetry scores
  const eyeSym = getScore(aggregates, "symmetry.eye_symmetry");
  const browSym = getScore(aggregates, "symmetry.brow_symmetry");
  const noseAxis = getScore(aggregates, "symmetry.nose_midline_alignment");
  const mouthSym = getScore(aggregates, "symmetry.mouth_symmetry");
  const jawAxis = getScore(aggregates, "symmetry.jaw_chin_midline");
  const cheekBalance = getScore(aggregates, "symmetry.cheekbone_balance");

  // Proportions
  const thirds = getScore(aggregates, "proportions.vertical_thirds_balance");
  const fifths = getScore(aggregates, "proportions.horizontal_fifths_balance");
  const eyeIntercanthal = getScore(
    aggregates,
    "proportions.eye_to_intercanthal_ratio",
  );

  // Signed ratios (face_shape)
  const foreheadJaw = getScore(aggregates, "face_shape.forehead_vs_jaw_ratio");
  const lengthWidth = getScore(
    aggregates,
    "face_shape.face_length_vs_width_ratio",
  );

  const mirrorRegions = [
    {
      key: "brows",
      label: { en: "Brows", fr: "Sourcils" },
      score: browSym.score,
      scrollTargetId: symUpperAnchor,
    },
    {
      key: "eyes",
      label: { en: "Eyes", fr: "Yeux" },
      score: eyeSym.score,
      scrollTargetId: symUpperAnchor,
    },
    {
      key: "cheekbones",
      label: { en: "Cheekbones", fr: "Pommettes" },
      score: cheekBalance.score,
      scrollTargetId: symLowerAnchor,
    },
    {
      key: "nose",
      label: { en: "Nose axis", fr: "Axe du nez" },
      score: noseAxis.score,
      scrollTargetId: symUpperAnchor,
    },
    {
      key: "mouth",
      label: { en: "Mouth", fr: "Bouche" },
      score: mouthSym.score,
      scrollTargetId: symLowerAnchor,
    },
    {
      key: "jaw",
      label: { en: "Jaw axis", fr: "Axe mâchoire" },
      score: jawAxis.score,
      scrollTargetId: symLowerAnchor,
    },
  ];

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Symmetry",
          fr: "Symétrie",
        })}
        title={i18n(language, {
          en: "Your facial structure",
          fr: "Ta structure faciale",
        })}
        argument={heroArgument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={mergeHeroRightSlot(
          shapeDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Face shape", fr: "Forme du visage" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {shapeDisplay}
              </p>
            </div>
          ) : null,
          heroAside,
        )}
      />

      {/* Face shape gallery + signed ratios */}
      <Card
        id={faceTaxonomyAnchor}
        className={`${workerSectionCardClassName} scroll-mt-28 sm:scroll-mt-32`}
      >
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, {
                en: "Face shape taxonomy",
                fr: "Taxonomie morphologique",
              })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Where your morphology fits",
                fr: "Où se situe ta morphologie",
              })}
            </h3>
            {shapeEnum.argument ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                {shapeEnum.argument}
              </p>
            ) : null}
          </div>

          {faceFrontShapeContourAssetSrc ? (
            <div className="flex justify-center">
              <AnalysisJobAssetPreviewThumb
                src={faceFrontShapeContourAssetSrc}
                alt={i18n(language, {
                  en: "Front-face scan overlay: face shape contour guide",
                  fr: "Repère contour de la forme du visage (prise frontale)",
                })}
                imgFit="contain"
                className="mx-auto w-fit max-w-[min(100%,20rem)] shrink-0 sm:max-w-[22rem]"
                imgClassName="max-h-[14rem] sm:max-h-[17rem]"
              />
            </div>
          ) : null}

          <FaceShapeGallery
            selected={shapeKey}
            language={language}
            taxonomyAnchorId={faceTaxonomyAnchor}
          />

          {widthHierarchy.value ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("face_shape.width_hierarchy")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "face_shape.width_hierarchy",
                    widthHierarchy.value,
                  ) ?? widthHierarchy.value}
                </span>
              </div>
              {widthHierarchy.argument ? (
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  {widthHierarchy.argument}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 grid gap-5 border-t border-white/10 pt-6 lg:grid-cols-2">
            <BipolarBar
              label={formatLabel("face_shape.forehead_vs_jaw_ratio")}
              leftLabel={i18n(language, {
                en: "Wider forehead",
                fr: "Front + large",
              })}
              rightLabel={i18n(language, {
                en: "Wider jaw",
                fr: "Mâchoire + large",
              })}
              score={foreheadJaw.score}
              argument={foreheadJaw.argument}
              language={language}
            />
            <BipolarBar
              label={formatLabel("face_shape.face_length_vs_width_ratio")}
              leftLabel={i18n(language, { en: "Wider", fr: "Plus large" })}
              rightLabel={i18n(language, { en: "Longer", fr: "Plus long" })}
              score={lengthWidth.score}
              argument={lengthWidth.argument}
              language={language}
            />
          </div>
        </CardContent>
      </Card>

      {/* Symmetry mirror */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, {
                  en: "Symmetry mirror",
                  fr: "Miroir de symétrie",
                })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Left vs right balance",
                  fr: "Équilibre gauche / droite",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "Tap a badge to jump to the detailed symmetry score for that facial region.",
                  fr: "Appuie sur un badge pour ouvrir le détail du score de symétrie pour cette zone.",
                })}
              </p>
            </div>
            <SymmetryMirror regions={mirrorRegions} language={language} />
          </div>
        </CardContent>
      </Card>

      {/* Symmetry detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(browSym.score, eyeSym.score, noseAxis.score)}
          sectionId={symUpperAnchor}
          eyebrow={i18n(language, {
            en: "Upper face symmetry",
            fr: "Symétrie haut du visage",
          })}
          title={i18n(language, {
            en: "Brows, eyes & nose axis",
            fr: "Sourcils, yeux et axe du nez",
          })}
        >
          <ScoreBar
            label={formatLabel("symmetry.brow_symmetry")}
            score={browSym.score}
            argument={browSym.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(WORKER_KEY, "symmetry.brow_symmetry")}
          />
          <ScoreBar
            label={formatLabel("symmetry.eye_symmetry")}
            score={eyeSym.score}
            argument={eyeSym.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(WORKER_KEY, "symmetry.eye_symmetry")}
          />
          <ScoreBar
            label={formatLabel("symmetry.nose_midline_alignment")}
            score={noseAxis.score}
            argument={noseAxis.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(WORKER_KEY, "symmetry.nose_midline_alignment")}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(mouthSym.score, jawAxis.score, cheekBalance.score)}
          sectionId={symLowerAnchor}
          eyebrow={i18n(language, {
            en: "Lower face symmetry",
            fr: "Symétrie bas du visage",
          })}
          title={i18n(language, {
            en: "Mouth, jaw & cheekbones",
            fr: "Bouche, mâchoire et pommettes",
          })}
        >
          <ScoreBar
            label={formatLabel("symmetry.mouth_symmetry")}
            score={mouthSym.score}
            argument={mouthSym.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(WORKER_KEY, "symmetry.mouth_symmetry")}
          />
          <ScoreBar
            label={formatLabel("symmetry.jaw_chin_midline")}
            score={jawAxis.score}
            argument={jawAxis.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(WORKER_KEY, "symmetry.jaw_chin_midline")}
          />
          <ScoreBar
            label={formatLabel("symmetry.cheekbone_balance")}
            score={cheekBalance.score}
            argument={cheekBalance.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(WORKER_KEY, "symmetry.cheekbone_balance")}
          />
        </SectionShell>
      </div>

      {/* Proportions diagram */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, {
                  en: "Classical proportions",
                  fr: "Proportions classiques",
                })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Thirds & fifths grid",
                  fr: "Grille tiers et cinquièmes",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "Your face is read against the canonical grid: three vertical thirds (forehead, midface, lower face) and five horizontal fifths each as wide as one eye.",
                  fr: "Ton visage est lu sur la grille canonique : trois tiers verticaux (front, milieu, bas) et cinq cinquièmes horizontaux d'une largeur d'œil chacun.",
                })}
              </p>
            </div>
            <ProportionsCanvas
              thirdsScore={thirds.score}
              fifthsScore={fifths.score}
              language={language}
              thirdsMetricId={workerMetricAnchorId(
                WORKER_KEY,
                "proportions.vertical_thirds_balance",
              )}
              fifthsMetricId={workerMetricAnchorId(
                WORKER_KEY,
                "proportions.horizontal_fifths_balance",
              )}
              verticalThirdsAssetSrc={verticalThirdsAssetSrc}
              faceFrontShapeContourAssetSrc={faceFrontShapeContourAssetSrc}
            />
          </div>
        </CardContent>
      </Card>

      {/* Proportions detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(thirds.score, fifths.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "proportions-vertical")}
          eyebrow={i18n(language, {
            en: "Vertical balance",
            fr: "Équilibre vertical",
          })}
          title={i18n(language, {
            en: "Thirds & fifths",
            fr: "Tiers et cinquièmes",
          })}
        >
          <ScoreBar
            label={formatLabel("proportions.vertical_thirds_balance")}
            score={thirds.score}
            argument={thirds.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "proportions.vertical_thirds_balance",
            )}
          />
          <ScoreBar
            label={formatLabel("proportions.horizontal_fifths_balance")}
            score={fifths.score}
            argument={fifths.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "proportions.horizontal_fifths_balance",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(eyeIntercanthal.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "eye-proportion")}
          eyebrow={i18n(language, {
            en: "Eye proportion",
            fr: "Proportion des yeux",
          })}
          title={i18n(language, {
            en: "Eye / intercanthal ratio",
            fr: "Rapport œil / intercanthal",
          })}
        >
          <ScoreBar
            label={formatLabel("proportions.eye_to_intercanthal_ratio")}
            score={eyeIntercanthal.score}
            argument={eyeIntercanthal.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "proportions.eye_to_intercanthal_ratio",
            )}
          />
        </SectionShell>
      </div>
    </div>
  );
}
