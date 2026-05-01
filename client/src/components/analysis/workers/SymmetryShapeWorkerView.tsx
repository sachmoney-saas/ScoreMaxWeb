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

const WORKER_KEY = "symmetry_shape";

/* ----------------------------------------------------------------------------
 * Face-shape gallery
 *
 * SVG silhouettes for each canonical face shape. Used to highlight the
 * detected morphology, while showing the user the full visual taxonomy.
 * ------------------------------------------------------------------------- */

type FaceShapeKey =
  | "oval"
  | "round"
  | "square"
  | "heart"
  | "diamond"
  | "oblong";

const FACE_SHAPE_PATHS: Record<FaceShapeKey, string> = {
  oval: "M50 6 C70 6 78 26 78 56 C78 90 65 114 50 114 C35 114 22 90 22 56 C22 26 30 6 50 6 Z",
  round:
    "M50 8 C76 8 86 36 86 60 C86 92 70 112 50 112 C30 112 14 92 14 60 C14 36 24 8 50 8 Z",
  square:
    "M28 14 L72 14 C78 14 80 30 80 44 L80 84 C80 100 76 110 60 110 L40 110 C24 110 20 100 20 84 L20 44 C20 30 22 14 28 14 Z",
  heart:
    "M22 16 C32 8 68 8 78 16 C84 30 78 56 68 78 C58 100 54 114 50 114 C46 114 42 100 32 78 C22 56 16 30 22 16 Z",
  diamond:
    "M50 6 L60 28 C70 38 84 50 84 60 C84 80 68 100 56 110 L50 114 L44 110 C32 100 16 80 16 60 C16 50 30 38 40 28 L50 6 Z",
  oblong:
    "M50 4 C72 4 78 30 78 64 C78 100 66 116 50 116 C34 116 22 100 22 64 C22 30 28 4 50 4 Z",
};

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
}: {
  selected: FaceShapeKey | null;
  language: AppLanguage;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {FACE_SHAPE_ORDER.map((shape) => {
        const isActive = shape === selected;
        return (
          <div
            key={shape}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
              isActive
                ? "border-white/45 bg-white/[0.08] shadow-[0_0_28px_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <svg
              viewBox="0 0 100 120"
              className="h-16 w-12 sm:h-20 sm:w-16"
              role="img"
              aria-label={FACE_SHAPE_LABELS[shape].en}
            >
              <path
                d={FACE_SHAPE_PATHS[shape]}
                fill={isActive ? "#e9f1f4" : "rgba(154,174,181,0.18)"}
                stroke={
                  isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.18)"
                }
                strokeWidth={isActive ? 1.6 : 1.2}
              />
            </svg>
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
          </div>
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
 * Stylized face SVG — generic outline used as canvas for symmetry/proportions
 * overlays. ViewBox 0 0 200 260, with realistic landmarks.
 * ------------------------------------------------------------------------- */

const FACE_OUTLINE_PATH =
  "M100 14 C140 14 160 50 160 110 C160 180 134 240 100 244 C66 240 40 180 40 110 C40 50 60 14 100 14 Z";

function FaceCanvas({ children }: { children?: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 260"
      className="mx-auto block h-auto w-full max-w-[300px]"
    >
      {/* Outline */}
      <path
        d={FACE_OUTLINE_PATH}
        fill="rgba(154,174,181,0.06)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.4"
      />
      {/* Brows */}
      <path
        d="M62 92 Q78 84 96 92"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M104 92 Q122 84 138 92"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Eyes */}
      <ellipse cx="78" cy="106" rx="9" ry="4" fill="rgba(255,255,255,0.28)" />
      <ellipse cx="122" cy="106" rx="9" ry="4" fill="rgba(255,255,255,0.28)" />
      {/* Nose */}
      <path
        d="M100 112 L96 154 Q100 162 104 154 Z"
        fill="rgba(255,255,255,0.18)"
      />
      {/* Mouth */}
      <path
        d="M84 188 Q100 196 116 188"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {children}
    </svg>
  );
}

/* ----------------------------------------------------------------------------
 * Symmetry mirror — overlay region chips on the face
 * ------------------------------------------------------------------------- */

function SymmetryMirror({
  regions,
  language,
}: {
  regions: { key: string; label: { en: string; fr: string }; x: number; y: number; score: number | null }[];
  language: AppLanguage;
}) {
  return (
    <div className="relative">
      <FaceCanvas>
        {/* Central vertical axis */}
        <line
          x1="100"
          y1="6"
          x2="100"
          y2="252"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </FaceCanvas>

      {/* Region chips positioned absolutely */}
      <div className="pointer-events-none absolute inset-0">
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
              <div
                key={r.key}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-950/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white ring-1 backdrop-blur ${ringColor}`}
                style={{ left: `${r.x}%`, top: `${r.y}%` }}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                  <span className="text-zinc-300">
                    {i18n(language, r.label)}
                  </span>
                  <span className="font-display text-[11px] font-bold tabular-nums text-white">
                    {r.score.toFixed(r.score % 1 === 0 ? 0 : 1)}
                  </span>
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Proportions canvas — overlay vertical thirds + horizontal fifths
 * ------------------------------------------------------------------------- */

function ProportionsCanvas({
  thirdsScore,
  fifthsScore,
  language,
}: {
  thirdsScore: number | null;
  fifthsScore: number | null;
  language: AppLanguage;
}) {
  const thirdLines = [
    { y: 70, key: "upper", label: { en: "Upper third", fr: "Tiers sup." } },
    { y: 134, key: "middle", label: { en: "Middle third", fr: "Tiers moyen" } },
    { y: 198, key: "lower", label: { en: "Lower third", fr: "Tiers inf." } },
  ];
  const fifthLines = [
    { x: 40, label: "1/5" },
    { x: 80, label: "2/5" },
    { x: 120, label: "3/5" },
    { x: 160, label: "4/5" },
  ];

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
      <FaceCanvas>
        {/* Vertical thirds — horizontal lines */}
        {thirdLines.map((tl) => (
          <line
            key={`third-${tl.key}`}
            x1={32}
            x2={168}
            y1={tl.y}
            y2={tl.y}
            stroke={colorFor(thirdsBand)}
            strokeWidth="1.2"
            strokeDasharray="3 4"
          />
        ))}

        {/* Horizontal fifths — vertical lines */}
        {fifthLines.map((fl) => (
          <line
            key={`fifth-${fl.x}`}
            x1={fl.x}
            x2={fl.x}
            y1={20}
            y2={236}
            stroke={colorFor(fifthsBand)}
            strokeWidth="1"
            strokeDasharray="2 5"
            opacity="0.7"
          />
        ))}

        {/* Third labels */}
        {thirdLines.map((tl) => (
          <text
            key={`label-${tl.key}`}
            x={172}
            y={tl.y - 28}
            fontSize="8"
            fontWeight="700"
            fill="#aab2bd"
            letterSpacing="0.08em"
          >
            {i18n(language, tl.label).toUpperCase()}
          </text>
        ))}
      </FaceCanvas>

      <div className="flex items-center justify-center gap-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-4 rounded-sm"
            style={{ backgroundColor: colorFor(thirdsBand) }}
          />
          {i18n(language, { en: "Vertical thirds", fr: "Tiers verticaux" })}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-4 rounded-sm"
            style={{ backgroundColor: colorFor(fifthsBand) }}
          />
          {i18n(language, { en: "Horizontal fifths", fr: "Cinquièmes horizontaux" })}
        </span>
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
}

export function SymmetryShapeWorkerView({
  aggregates,
  language,
}: SymmetryShapeWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );

  // Global
  const overall = getScore(aggregates, "overall_face_structure_score");

  // Shape
  const shapeEnum = getEnum(aggregates, "face_shape.shape");
  const shapeKey = normalizeShape(shapeEnum.value);
  const shapeDisplay = shapeEnum.value
    ? formatAggregateDisplayValue(
        WORKER_KEY,
        "face_shape.shape",
        shapeEnum.value,
        locale,
      )
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
  const lowerThird = getScore(
    aggregates,
    "proportions.lower_third_subdivision",
  );
  const fifths = getScore(aggregates, "proportions.horizontal_fifths_balance");
  const eyeIntercanthal = getScore(
    aggregates,
    "proportions.eye_to_intercanthal_ratio",
  );
  const noseInnerEye = getScore(
    aggregates,
    "proportions.nose_to_inner_eye_alignment",
  );
  const mouthPupil = getScore(
    aggregates,
    "proportions.mouth_to_pupil_alignment",
  );

  // Signed ratios (face_shape)
  const foreheadJaw = getScore(aggregates, "face_shape.forehead_vs_jaw_ratio");
  const lengthWidth = getScore(
    aggregates,
    "face_shape.face_length_vs_width_ratio",
  );

  // Symmetry mirror regions, positioned in % over the face canvas
  const mirrorRegions = [
    {
      key: "brows",
      label: { en: "Brows", fr: "Sourcils" },
      x: 50,
      y: 28,
      score: browSym.score,
    },
    {
      key: "eyes",
      label: { en: "Eyes", fr: "Yeux" },
      x: 50,
      y: 41,
      score: eyeSym.score,
    },
    {
      key: "cheekbones",
      label: { en: "Cheekbones", fr: "Pommettes" },
      x: 18,
      y: 56,
      score: cheekBalance.score,
    },
    {
      key: "nose",
      label: { en: "Nose axis", fr: "Axe du nez" },
      x: 82,
      y: 56,
      score: noseAxis.score,
    },
    {
      key: "mouth",
      label: { en: "Mouth", fr: "Bouche" },
      x: 50,
      y: 74,
      score: mouthSym.score,
    },
    {
      key: "jaw",
      label: { en: "Jaw axis", fr: "Axe mâchoire" },
      x: 50,
      y: 88,
      score: jawAxis.score,
    },
  ];

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Symmetry & shape",
          fr: "Symétrie et forme",
        })}
        title={i18n(language, {
          en: "Your facial structure",
          fr: "Ta structure faciale",
        })}
        argument={overall.argument}
        score={overall.score}
        rightSlot={
          shapeDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Face shape", fr: "Forme du visage" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {shapeDisplay}
              </p>
            </div>
          ) : null
        }
      />

      {/* Face shape gallery + signed ratios */}
      <Card className={workerSectionCardClassName}>
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

          <FaceShapeGallery selected={shapeKey} language={language} />

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
                  en: "The dashed central axis represents the perfect midline. Each region badge shows how well the left and right sides mirror each other.",
                  fr: "L'axe central pointillé représente la ligne médiane idéale. Chaque badge montre à quel point les côtés gauche et droit se correspondent.",
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
          />
          <ScoreBar
            label={formatLabel("symmetry.eye_symmetry")}
            score={eyeSym.score}
            argument={eyeSym.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("symmetry.nose_midline_alignment")}
            score={noseAxis.score}
            argument={noseAxis.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
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
          />
          <ScoreBar
            label={formatLabel("symmetry.jaw_chin_midline")}
            score={jawAxis.score}
            argument={jawAxis.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("symmetry.cheekbone_balance")}
            score={cheekBalance.score}
            argument={cheekBalance.argument}
            language={language}
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
            />
          </div>
        </CardContent>
      </Card>

      {/* Proportions detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Vertical balance",
            fr: "Équilibre vertical",
          })}
          title={i18n(language, {
            en: "Thirds & subdivisions",
            fr: "Tiers et subdivisions",
          })}
        >
          <ScoreBar
            label={formatLabel("proportions.vertical_thirds_balance")}
            score={thirds.score}
            argument={thirds.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("proportions.lower_third_subdivision")}
            score={lowerThird.score}
            argument={lowerThird.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("proportions.horizontal_fifths_balance")}
            score={fifths.score}
            argument={fifths.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Alignment ratios",
            fr: "Ratios d'alignement",
          })}
          title={i18n(language, {
            en: "Eyes, nose & mouth alignment",
            fr: "Alignement yeux, nez et bouche",
          })}
        >
          <ScoreBar
            label={formatLabel("proportions.eye_to_intercanthal_ratio")}
            score={eyeIntercanthal.score}
            argument={eyeIntercanthal.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("proportions.nose_to_inner_eye_alignment")}
            score={noseInnerEye.score}
            argument={noseInnerEye.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("proportions.mouth_to_pupil_alignment")}
            score={mouthPupil.score}
            argument={mouthPupil.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
