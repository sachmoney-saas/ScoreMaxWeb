import * as React from "react";
import {
  buildAnalysisJobAssetPreviewUrl,
} from "@/lib/face-analysis";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  calculateWorkerFaceScore,
  computeMeanLeafScores10,
  skinRadarAxisHighlights,
  skinRadarAxisPaint,
} from "@/lib/face-analysis-score";
import {
  BodyfatCompositionMatrixVisual,
  BodyfatWeakestScoreCallout,
  getBodyfatCompositionSharpness,
} from "./workers/BodyfatCompositionMatrix";
import {
  WorkerSignatureRadar,
  type WorkerSignatureRadarPoint,
  WorkerStanceMatrix,
} from "./workers/WorkerVisualizations";
import { EyebrowBoldFeminineMatrix } from "./workers/EyebrowBoldFeminineMatrix";
import {
  eyebrowArchScoreForMatrix,
  normalizeBrowShape,
} from "./workers/eyebrowShapeNormalize";
import {
  getEnum,
  getNumber,
  getScore,
  getString,
  hasAnyScore,
} from "./workers/_shared";
import { AnalysisJobAssetPreviewThumb } from "./workers/AnalysisJobAssetPreviewThumb";
import {
  extractAge,
  extractAgeArgument,
  MaturityTimeline,
} from "./workers/AgeWorkerView";

export const AnalysisJobScanPreviewContext = React.createContext<{
  jobId: string;
  userId: string;
} | null>(null);

export function AnalysisJobScanPreviewProvider({
  value,
  children,
}: {
  value: { jobId: string; userId: string } | null;
  children: React.ReactNode;
}) {
  return (
    <AnalysisJobScanPreviewContext.Provider value={value}>
      {children}
    </AnalysisJobScanPreviewContext.Provider>
  );
}

/* ============================================================================
 * Mini building blocks
 *
 * Smaller, denser primitives designed to fit inside a dashboard preview card.
 * They share the brand DA from `workers/_shared.tsx` (same gradients, same
 * quality-band semantics) so previews and detail pages feel cohesive.
 * ========================================================================= */

/** Centered preview hero: copy + visuals (headline score ring lives on the card title row). */
const PREVIEW_HERO = "flex w-full flex-col items-center gap-3 text-center";
/** Tighter stack so signature preview radars (peau, mâchoire) sit closer to the copy. */
const PREVIEW_HERO_SIGNATURE_RADAR =
  "flex w-full flex-col items-center gap-3 text-center sm:gap-4";
const PREVIEW_COPY = "w-full max-w-md text-balance";

/**
 * Cadre fixe pour vignettes scan face (ratio h×w puis sm),
 * référence : preview Symétrie (contour morphologique).
 */
const PREVIEW_SYM_SCAN_FRAME_CLASS =
  "h-48 w-40 shrink-0 sm:h-52 sm:w-44";
const PREVIEW_SYM_SCAN_IMG_CLASSNAME = "object-cover";

export type MiniRingHighlight = "default" | "strength" | "weakness";

export function MiniRing({
  score,
  scale = 10,
  size = 76,
  fractionDigits,
  highlight = "default",
  /** Couleur du cercle de piste vide (lisible sur fond clair ou sombre). */
  trackStroke = "rgba(255,255,255,0.08)",
  /** Couleur du chiffre au centre ; si absent, dérivée de `highlight`. */
  centerFill: centerFillProp,
}: {
  score: number;
  scale?: number;
  size?: number;
  fractionDigits?: number;
  /** Coloring for overview worker cards in top-3 strengths vs weaknesses. */
  highlight?: MiniRingHighlight;
  trackStroke?: string;
  centerFill?: string;
}) {
  const gradientId = React.useId().replace(/:/g, "");
  const clamped = Math.max(0, Math.min(score, scale));
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / scale) * circumference;
  const decimals =
    fractionDigits !== undefined
      ? fractionDigits
      : clamped % 1 === 0
        ? 0
        : 1;

  const arcGradient =
    highlight === "strength"
      ? (
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
        )
      : highlight === "weakness"
        ? (
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#f87171" />
            </linearGradient>
          )
        : (
            <linearGradient id={gradientId} x1="12%" y1="88%" x2="88%" y2="12%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="22%" stopColor="#cbd5e1" />
              <stop offset="48%" stopColor="#ffffff" />
              <stop offset="72%" stopColor="#e8eef5" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
          );

  const textFill =
    centerFillProp ??
    (highlight === "strength"
      ? "#6ee7b7"
      : highlight === "weakness"
        ? "#fca5a5"
        : "#ffffff");

  return (
    <svg
      viewBox="0 0 72 72"
      width={size}
      height={size}
      className="shrink-0"
      role="img"
      aria-label={`Score ${clamped.toFixed(decimals)} sur ${scale}`}
    >
      <defs>{arcGradient}</defs>
      <circle
        cx="36"
        cy="36"
        r={radius}
        fill="none"
        stroke={trackStroke}
        strokeWidth="6"
      />
      <circle
        cx="36"
        cy="36"
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 36 36)"
      />
      <text
        x="36"
        y="36"
        textAnchor="middle"
        dominantBaseline="middle"
        className="font-display"
        fontSize="18"
        fontWeight="700"
        fill={textFill}
      >
        {clamped.toFixed(decimals)}
      </text>
    </svg>
  );
}

function MiniBar({
  label,
  score,
  scale = 10,
}: {
  label: string;
  score: number | null;
  scale?: number;
}) {
  if (score === null) return null;
  const clamped = Math.max(0, Math.min(score, scale));
  const pct = (clamped / scale) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-zinc-300">
          {label}
        </span>
        <span className="font-display text-xs font-bold tabular-nums text-white">
          {clamped.toFixed(clamped % 1 === 0 ? 0 : 1)}
          <span className="ml-0.5 text-[9px] font-semibold text-zinc-500">
            /{scale}
          </span>
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#9aaeb5] via-[#bcd0d6] to-[#e9f1f4]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ColorChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
      <span
        className="h-6 w-6 shrink-0 rounded-full ring-1 ring-white/25"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {label}
        </p>
        <p className="truncate text-xs font-semibold text-white">
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  band,
}: {
  label: string;
  value: string;
  band?: "excellent" | "good" | "moderate" | "weak" | null;
}) {
  const tone =
    band === "excellent"
      ? "border-emerald-300/30 bg-emerald-400/10"
      : band === "good"
        ? "border-lime-300/25 bg-lime-400/10"
        : band === "moderate"
          ? "border-amber-300/25 bg-amber-400/10"
          : band === "weak"
            ? "border-rose-300/25 bg-rose-400/10"
            : "border-white/10 bg-white/[0.04]";
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${tone}`}
    >
      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        {label}
      </span>
      <span className="truncate text-xs font-semibold text-white">{value}</span>
    </div>
  );
}

function EmptyPreview({ language }: { language: AppLanguage }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3 text-xs text-zinc-500">
      {i18n(language, {
        en: "No structured signals available yet for this worker.",
        fr: "Pas encore de signaux structurés pour ce worker.",
      })}
    </div>
  );
}

/* ============================================================================
 * Color palettes (reused from worker views)
 * ========================================================================= */

const SKIN_TONE_HEX: Record<string, string> = {
  very_fair: "#f5e1d6",
  fair: "#ecc8b0",
  light: "#ecc8b0",
  medium: "#d09a72",
  olive: "#a87752",
  tan: "#7c5634",
  dark: "#4a2e1e",
  deep: "#3a2114",
};

const HAIR_COLOR_HEX: Record<string, string> = {
  black: "#0f0d0c",
  dark_brown: "#3d2419",
  medium_brown: "#6b4329",
  brown: "#6b4329",
  light_brown: "#a06d3f",
  dark_blonde: "#a98454",
  blonde: "#d8b777",
  red: "#a53f1d",
  auburn: "#8a3a1f",
  grey: "#9da0a3",
  white: "#e8e9ec",
};

const IRIS_COLOR_HEX: Record<string, string> = {
  black: "#1a1413",
  almost_black: "#1a1410",
  dark_brown: "#3a261a",
  medium_brown: "#6a4528",
  brown: "#6a4528",
  light_brown: "#a06f43",
  hazel: "#9a7a3f",
  hazel_brown: "#8b6f47",
  hazel_green: "#7a8f5c",
  amber: "#b8860b",
  green: "#4f7d4f",
  light_green: "#8fbc8f",
  dark_green: "#2d5a3a",
  blue_grey: "#7488a0",
  grey_blue: "#6b7d8f",
  grey: "#9da4ad",
  pure_grey: "#9da4ad",
  blue: "#3d6a9c",
  dark_blue: "#2a5080",
  light_blue: "#7cb1d6",
  central_heterochromia: "#2e221b",
  sectoral_heterochromia: "#231a13",
};

const LIP_COLOR_HEX: Record<string, string> = {
  very_pale: "#f1d9d2",
  pale_pink: "#e9b9b3",
  pink: "#d49a9b",
  rose: "#c0727b",
  red: "#9c3d4a",
  deep_red: "#6e2330",
  nude: "#c79a86",
  dark: "#4a2a2a",
};

/** Eyebrow palette (align with `ColoringWorkerView` + model enums). */
const EYEBROW_COLOR_HEX: Record<string, string> = {
  black: "#0f0d0c",
  dark_brown: "#3d2419",
  brown: "#6b4329",
  medium_brown: "#6b4329",
  light_brown: "#a06d3f",
  blonde: "#d8b777",
  grey: "#9da0a3",
};

const FITZPATRICK_HEX: Record<string, string> = {
  i: "#f6e3d4",
  ii: "#ecc8b0",
  iii: "#d8a37a",
  iv: "#b07a4f",
  v: "#7d4a2b",
  vi: "#3e2418",
};

function normalizeKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function fitzpatrickKey(value: string | null): string | null {
  if (!value) return null;
  const k = value.trim().toLowerCase();
  // accepts "type 1", "1", "i", "type i" ...
  const match = k.match(/(?:type\s*)?([1-6]|i{1,3}|iv|v|vi)/);
  if (!match) return null;
  const v = match[1];
  if (v === "1") return "i";
  if (v === "2") return "ii";
  if (v === "3") return "iii";
  if (v === "4") return "iv";
  if (v === "5") return "v";
  if (v === "6") return "vi";
  return v;
}

function isUnknownEnumValue(value: string | null): boolean {
  if (!value) return true;
  const k = value.trim().toLowerCase();
  return (
    k === "non renseigné" ||
    k === "non renseigne" ||
    k === "n/a" ||
    k === "unknown"
  );
}

/* ============================================================================
 * Per-worker previews
 * ========================================================================= */

type PreviewProps = {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
};

/* ----------------------------------- Coloring ------------------------------------- */

function ColoringPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const global =
    getScore(aggregates, "global_coloring_score").score !== null
      ? getScore(aggregates, "global_coloring_score")
      : getScore(aggregates, "global_coloring");

  const skinTone = getEnum(aggregates, "skin.tone").value;
  const hairColor = getEnum(aggregates, "hair.color").value;
  const browColor = getEnum(aggregates, "eyebrows.color").value;
  const lipColor = getEnum(aggregates, "lips.color").value;
  const contrastType = getEnum(aggregates, "contrast.contrast_type").value;

  /** Order: hair → skin → brows → lips (matches full worker view). */
  const swatches: {
    key: string;
    zoneLabel: string;
    value: string | null;
    hex: string | null;
  }[] = [
    {
      key: "hair",
      zoneLabel: i18n(language, { en: "Hair", fr: "Cheveux" }),
      value: hairColor,
      hex: hairColor
        ? HAIR_COLOR_HEX[normalizeKey(hairColor) ?? ""] ?? null
        : null,
    },
    {
      key: "skin",
      zoneLabel: i18n(language, { en: "Skin", fr: "Peau" }),
      value: skinTone,
      hex: skinTone
        ? SKIN_TONE_HEX[normalizeKey(skinTone) ?? ""] ?? null
        : null,
    },
    {
      key: "brows",
      zoneLabel: i18n(language, { en: "Eyebrows", fr: "Sourcils" }),
      value: browColor,
      hex: browColor
        ? EYEBROW_COLOR_HEX[normalizeKey(browColor) ?? ""] ?? null
        : null,
    },
    {
      key: "lips",
      zoneLabel: i18n(language, { en: "Lips", fr: "Lèvres" }),
      value: lipColor,
      hex: lipColor
        ? LIP_COLOR_HEX[normalizeKey(lipColor) ?? ""] ?? null
        : null,
    },
  ];

  const argumentText =
    global.argument ??
    i18n(language, {
      en: "Detected harmony across skin, hair, brows and lips.",
      fr: "Harmonie détectée entre peau, cheveux, sourcils et lèvres.",
    });

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-xs leading-relaxed text-zinc-300 line-clamp-4">
            {argumentText}
          </p>
          {contrastType ? (
            <div className="mt-2 flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                {i18n(language, { en: "Contrast", fr: "Contraste" })}{" "}
                <span className="text-white">
                  {formatAggregateDisplayValue(
                    "coloring",
                    "contrast.contrast_type",
                    contrastType,
                    locale,
                  )}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-1.5 rounded-xl border border-white/15 bg-white/[0.02] p-2 pt-2.5">
        {swatches.map((s) => (
          <div key={s.key} className="flex min-w-0 flex-col items-center gap-1">
            <span className="w-full truncate text-center text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-zinc-400">
              {s.zoneLabel}
            </span>
            <div
              className="h-8 w-full min-w-0 rounded-md border border-white/10 shadow-inner"
              style={
                s.hex
                  ? { backgroundColor: s.hex }
                  : { backgroundColor: "rgba(255,255,255,0.05)" }
              }
              title={s.value ?? undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------- Skin ------------------------------------- */

/** Compact axis labels — aligned with `SkinWorkerView` radar. */
const SKIN_PREVIEW_RADAR_LABELS: Record<string, { en: string; fr: string }> = {
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
  "acne_and_scarring.atrophic_scarring": {
    en: "Scarring",
    fr: "Cicatrices",
  },
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

/** 3+ axes, same geometry/styling as the skin preview radar (DRY). */
function PreviewSignatureRadar({
  data,
  language,
}: {
  data: { label: string; score: number }[];
  language: AppLanguage;
}) {
  const gradientId = React.useId().replace(/:/g, "");
  /** Horizontal pad for long labels; slightly tighter vertically to reduce empty bands in the SVG. */
  const viewPadX = 102;
  const viewPadY = 89;
  const size = 510;
  const center = size / 2;
  const maxRadius = 176;
  const n = data.length;
  if (n < 3) return null;

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
    const r = maxRadius + 44;
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

  const scaleHint = i18n(language, {
    en: "Scale 0–10 toward outer ring",
    fr: "Échelle 0–10 vers l’anneau extérieur",
  });

  return (
    <svg
      viewBox={`-${viewPadX} -${viewPadY} ${size + 2 * viewPadX} ${size + 2 * viewPadY}`}
      className="mx-auto h-auto w-full max-w-[min(100%,640px)] shrink-0 overflow-visible"
      role="img"
      aria-label={scaleHint}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9aaeb5" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d6e4ff" stopOpacity="0.22" />
        </linearGradient>
      </defs>

      {ringValues.map((value) => (
        <circle
          key={`ring-${value}`}
          cx={center}
          cy={center}
          r={(value / 10) * maxRadius}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.35"
        />
      ))}

      {data.map((_, i) => {
        const end = polar(i, 10);
        return (
          <line
            key={`spoke-${i}`}
            x1={center}
            y1={center}
            x2={end.x}
            y2={end.y}
            stroke="rgba(255,255,255,0.11)"
            strokeWidth="1.25"
          />
        );
      })}

      <polygon
        points={polygon}
        fill={`url(#${gradientId})`}
        stroke="#cfdde2"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />

      {valuePoints.map((p, i) => {
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        return (
          <circle
            key={`pt-${i}`}
            cx={p.x}
            cy={p.y}
            r={5.2}
            fill={paint.dotFill}
            stroke={paint.dotStroke}
            strokeWidth="1.65"
          />
        );
      })}

      {/* Scale reference along bottom ray (0–10 toward perimeter) */}
      {[0, 2.5, 5, 7.5, 10].map((v) => {
        const ang = Math.PI / 2;
        const r = (v / 10) * maxRadius;
        const pad = v === 0 ? 20 : v === 10 ? 20 : 17;
        const xo = center + (r + pad) * Math.cos(ang);
        const yo = center + (r + pad) * Math.sin(ang);
        return (
          <text
            key={`tick-${v}`}
            x={xo}
            y={yo}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12.5"
            fontWeight="600"
            fill="#6b7280"
          >
            {v === Math.floor(v) ? String(v) : v}
          </text>
        );
      })}

      {data.map((d, i) => {
        const lp = labelPolar(i);
        const scoreTxt = d.score.toFixed(d.score % 1 === 0 ? 0 : 1);
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        const scoreFontPx = 15.5;
        const scoreOutlineW = Math.max(1, scoreFontPx * 0.068);
        return (
          <React.Fragment key={`label-${i}`}>
            <text
              x={lp.x}
              y={lp.y - 11}
              textAnchor={lp.anchor}
              dominantBaseline="middle"
              fontSize="16"
              fontWeight="600"
              fill={paint.labelFill}
              letterSpacing="0.03em"
            >
              {d.label}
            </text>
            <text
              x={lp.x}
              y={lp.y + 19}
              textAnchor={lp.anchor}
              dominantBaseline="middle"
              fontSize={scoreFontPx}
              letterSpacing="0.03em"
            >
              <tspan
                fontWeight="700"
                fill={paint.previewScoreFill}
                stroke="rgba(15,23,42,0.78)"
                strokeWidth={scoreOutlineW}
                paintOrder="stroke fill"
              >
                {scoreTxt}
              </tspan>
              <tspan
                fill={paint.previewMutedFill}
                fontWeight="600"
                stroke="none"
                strokeWidth="0"
              >
                {" "}
                /10
              </tspan>
            </text>
          </React.Fragment>
        );
      })}
    </svg>
  );
}

function SkinPreview({ aggregates, language }: PreviewProps) {
  const overallNested = getScore(aggregates, "global_score.overall_skin_score");
  const overallFlat = getScore(aggregates, "overall_skin_score");
  const overallLegacy = getScore(aggregates, "overall_skin");
  const global = {
    score:
      overallNested.score ?? overallFlat.score ?? overallLegacy.score ?? null,
    argument:
      overallNested.argument ??
      overallFlat.argument ??
      overallLegacy.argument ??
      null,
  };

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
  const activeAcne = getScore(aggregates, "acne_and_scarring.active_acne");
  const postInflammatory = getScore(
    aggregates,
    "acne_and_scarring.post_inflammatory_marks",
  );
  const atrophicScarring = getScore(
    aggregates,
    "acne_and_scarring.atrophic_scarring",
  );
  const colorUniformity = getScore(
    aggregates,
    "pigmentation_tone_and_redness.color_uniformity",
  );
  const redness = getScore(
    aggregates,
    "pigmentation_tone_and_redness.redness_and_erythema",
  );
  const sebumHydration = getScore(
    aggregates,
    "hydration_and_vitality.sebum_hydration_balance",
  );
  const firmness = getScore(
    aggregates,
    "hydration_and_vitality.firmness_and_elasticity",
  );

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
    {
      key: "acne_and_scarring.atrophic_scarring",
      value: atrophicScarring.score,
    },
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
      label: i18n(language, SKIN_PREVIEW_RADAR_LABELS[d.key]),
      score: d.value,
    }));

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO_SIGNATURE_RADAR}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Skin radar", fr: "Radar peau" })}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-zinc-300 line-clamp-3">
            {global.argument ??
              i18n(language, {
                en: "Texture, blemishes and tone synthesis.",
                fr: "Synthèse texture, imperfections et teint.",
              })}
          </p>
        </div>
        <div className="flex w-full justify-center px-0 sm:px-1">
          {radarData.length >= 3 ? (
            <PreviewSignatureRadar data={radarData} language={language} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- Bodyfat ------------------------------------- */

function BodyfatPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const global = getScore(
    aggregates,
    "global_estimation.facial_leanness_score",
  );
  const globalLegacy =
    global.score === null && !global.argument
      ? getScore(aggregates, "body_fat_estimation.facial_leanness_score")
      : global;
  const facial =
    globalLegacy.score !== null || globalLegacy.argument
      ? globalLegacy
      : global;

  const bfNum = getNumber(
    aggregates,
    "global_estimation.estimated_body_fat_percentage.value",
  );
  const bfRaw = getString(
    aggregates,
    "global_estimation.estimated_body_fat_percentage.value",
  );
  const bfDisplay =
    bfNum !== null
      ? `${bfNum % 1 === 0 ? String(bfNum) : bfNum.toFixed(1)} %`
      : bfRaw
        ? bfRaw.includes("%")
          ? bfRaw
          : `${bfRaw} %`
        : null;

  const waterEnum = getEnum(aggregates, "water_retention_flag.level");
  const waterDisplay = waterEnum.value
    ? formatAggregateDisplayValue(
        "bodyfat",
        "water_retention_flag.level",
        waterEnum.value,
        locale,
      ) ?? waterEnum.value
    : null;

  const sharpness = getBodyfatCompositionSharpness(aggregates);

  const headline = bfDisplay ?? waterDisplay ?? "—";
  const previewEyebrow =
    bfDisplay !== null
      ? i18n(language, {
          en: "Global estimation",
          fr: "Estimation globale",
        })
      : waterDisplay !== null
        ? i18n(language, {
            en: "Water retention",
            fr: "Rétention d'eau",
          })
        : i18n(language, {
            en: "Global estimation",
            fr: "Estimation globale",
          });

  return (
    <div className="space-y-4">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {previewEyebrow}
          </p>
          <p className="mt-1 font-display text-base font-bold text-white">
            {headline}
          </p>
          {facial.argument ? (
            <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
              {facial.argument}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          {i18n(language, {
            en: "Composition matrix",
            fr: "Matrice de composition",
          })}
        </p>
        <BodyfatCompositionMatrixVisual
          leanness={facial.score}
          sharpness={sharpness}
          language={language}
          compact
        />
        <BodyfatWeakestScoreCallout
          aggregates={aggregates}
          language={language}
          compact
        />
      </div>
    </div>
  );
}

/* -------------------------------- Symmetry & shape -------------------------------- */

function SymmetryShapePreview({ aggregates, language }: PreviewProps) {
  const previewJob = React.useContext(AnalysisJobScanPreviewContext);
  const faceShapeContourGuideSrc =
    previewJob !== null
      ? buildAnalysisJobAssetPreviewUrl({
          jobId: previewJob.jobId,
          userId: previewJob.userId,
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_SHAPE_CONTOUR",
        })
      : null;
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overallNested = getScore(
    aggregates,
    "global_score.overall_face_structure_score",
  );
  const overallFlat = getScore(aggregates, "overall_face_structure_score");
  const overallLegacy = getScore(aggregates, "overall_face_structure");
  const summaryArg =
    overallNested.argument ??
    overallFlat.argument ??
    overallLegacy.argument;
  const shapeEnum = getEnum(
    aggregates,
    "face_shape.overall_shape",
    "face_shape.shape",
  );
  const shapeDisplay = shapeEnum.value
    ? formatAggregateDisplayValue(
        "symmetry_shape",
        "face_shape.overall_shape",
        shapeEnum.value,
        locale,
      ) ?? shapeEnum.value
    : null;

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Face shape", fr: "Forme du visage" })}
          </p>
          <p className="mt-1 font-display text-base font-bold text-white">
            {shapeDisplay ?? "—"}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-400 line-clamp-2">
            {summaryArg ??
              i18n(language, {
                en: "Morphology and bilateral symmetry synthesis.",
                fr: "Synthèse morphologie et symétrie bilatérale.",
              })}
          </p>
        </div>
        <AnalysisJobAssetPreviewThumb
          src={faceShapeContourGuideSrc}
          alt={i18n(language, {
            en: "Front-face scan overlay: face shape contour guide",
            fr: "Repère contour de la forme du visage (prise frontale)",
          })}
          className={PREVIEW_SYM_SCAN_FRAME_CLASS}
          imgClassName={PREVIEW_SYM_SCAN_IMG_CLASSNAME}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Jaw ------------------------------------- */

function JawPreview({ aggregates, language }: PreviewProps) {
  const previewJob = React.useContext(AnalysisJobScanPreviewContext);
  const jawAngleSrc =
    previewJob !== null
      ? buildAnalysisJobAssetPreviewUrl({
          jobId: previewJob.jobId,
          userId: previewJob.userId,
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_JAW_ANGLE",
        })
      : null;
  const frontalOvalSrc =
    previewJob !== null
      ? buildAnalysisJobAssetPreviewUrl({
          jobId: previewJob.jobId,
          userId: previewJob.userId,
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_OVAL",
        })
      : null;
  const profileLeftSrc =
    previewJob !== null
      ? buildAnalysisJobAssetPreviewUrl({
          jobId: previewJob.jobId,
          userId: previewJob.userId,
          assetTypeCode: "GUIDE_TRACE_PROFILE_LEFT_JAW",
        })
      : null;

  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const width = getScore(aggregates, "frontal_geometry.jaw_width");
  const jawFace = getScore(
    aggregates,
    "frontal_geometry.jaw_to_face_proportion",
  );
  const ramus = getScore(aggregates, "profile_architecture.jaw_height_ramus");
  const length = getScore(aggregates, "profile_architecture.jawline_length");
  const jawSymmetry = getScore(
    aggregates,
    "symmetry_and_flare.jaw_symmetry",
  );
  const gonialFlare = getScore(
    aggregates,
    "symmetry_and_flare.gonial_flare_symmetry",
  );
  const shapeEnum = getEnum(aggregates, "frontal_geometry.jaw_shape_frontal");
  const shapeDisplay =
    shapeEnum.value && !isUnknownEnumValue(shapeEnum.value)
      ? formatAggregateDisplayValue(
          "jaw",
          "frontal_geometry.jaw_shape_frontal",
          shapeEnum.value,
          locale,
        ) ?? shapeEnum.value
      : null;

  const radarLabels: Record<string, { en: string; fr: string }> = {
    "frontal_geometry.jaw_width": { en: "Width", fr: "Largeur" },
    "frontal_geometry.jaw_to_face_proportion": {
      en: "Face proportion",
      fr: "Prop. visage",
    },
    "profile_architecture.jaw_height_ramus": { en: "Ramus", fr: "Ramus" },
    "profile_architecture.jawline_length": { en: "Length", fr: "Longueur" },
    "symmetry_and_flare.jaw_symmetry": { en: "Symmetry", fr: "Symétrie" },
    "symmetry_and_flare.gonial_flare_symmetry": {
      en: "Gonial flare",
      fr: "Flare gonial",
    },
  };

  const radarSource: { key: string; score: number | null }[] = [
    { key: "frontal_geometry.jaw_width", score: width.score },
    { key: "frontal_geometry.jaw_to_face_proportion", score: jawFace.score },
    { key: "profile_architecture.jaw_height_ramus", score: ramus.score },
    { key: "profile_architecture.jawline_length", score: length.score },
    { key: "symmetry_and_flare.jaw_symmetry", score: jawSymmetry.score },
    {
      key: "symmetry_and_flare.gonial_flare_symmetry",
      score: gonialFlare.score,
    },
  ];

  const radarData: WorkerSignatureRadarPoint[] = radarSource.flatMap((d) =>
    d.score === null
      ? []
      : [{ label: i18n(language, radarLabels[d.key]), score: d.score }],
  );

  const jawGuideThumbFrameClass =
    "mx-auto max-w-[min(100vw-3rem,21rem)] items-center justify-center sm:mx-0 sm:max-w-44";

  const jawGuideThumbImgClass =
    "max-h-[min(56vh,24rem)] w-auto max-w-full sm:max-h-52 sm:max-w-44";

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO_SIGNATURE_RADAR}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Frontal jaw shape", fr: "Forme frontale" })}
          </p>
          <p className="mt-1 font-display text-base font-bold text-white">
            {shapeDisplay ?? "—"}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-zinc-400 line-clamp-3">
            {width.argument ??
              jawFace.argument ??
              i18n(language, {
                en: "Jawline: frontal shape, width and face proportion.",
                fr: "Mâchoire : forme frontale, largeur et proportion au visage.",
              })}
          </p>
        </div>
        <div className="flex w-full justify-center px-0 sm:px-1">
          {radarData.length >= 3 ? (
            <WorkerSignatureRadar
              data={radarData}
              ariaLabel={i18n(language, {
                en: "Jaw signature radar",
                fr: "Radar de signature mandibulaire",
              })}
              sizePreset="large"
            />
          ) : null}
        </div>
        {(frontalOvalSrc || jawAngleSrc || profileLeftSrc) ? (
          <div
            className="grid w-full max-w-xl grid-cols-1 items-start justify-items-center gap-3 sm:grid-cols-3 sm:gap-2"
            aria-label={i18n(language, {
              en: "Jaw guide traces: frontal oval, frontal jaw angle, left profile",
              fr: "Repères mâchoire : ovale frontal, angle frontal, profil gauche",
            })}
          >
            <AnalysisJobAssetPreviewThumb
              src={frontalOvalSrc}
              alt={i18n(language, {
                en: "Scan overlay: frontal face oval guide",
                fr: "Repère ovale du visage — face",
              })}
              className={jawGuideThumbFrameClass}
              imgFit="contain"
              imgClassName={jawGuideThumbImgClass}
            />
            <AnalysisJobAssetPreviewThumb
              src={jawAngleSrc}
              alt={i18n(language, {
                en: "Scan overlay: frontal jaw angle guide",
                fr: "Repère angle mâchoire — face",
              })}
              className={jawGuideThumbFrameClass}
              imgFit="contain"
              imgClassName={jawGuideThumbImgClass}
            />
            <AnalysisJobAssetPreviewThumb
              src={profileLeftSrc}
              alt={i18n(language, {
                en: "Scan overlay: left profile jaw guide",
                fr: "Repère mâchoire — profil gauche",
              })}
              className={jawGuideThumbFrameClass}
              imgFit="contain"
              imgClassName={jawGuideThumbImgClass}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------- Eyebrows ---------------------------------- */

function BrowsPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overall = getScore(aggregates, "global_score.overall_brow_score");
  const symmetry = getScore(
    aggregates,
    "placement_and_symmetry.eyebrow_symmetry",
  );
  const density = getScore(
    aggregates,
    "density_grooming_and_glabella.eyebrow_density",
  );
  const thickness = getScore(
    aggregates,
    "density_grooming_and_glabella.eyebrow_thickness",
  );
  const shapeEnum = getEnum(aggregates, "geometry_and_shape.eyebrow_shape");
  const tiltEnum = getEnum(aggregates, "geometry_and_shape.eyebrow_tilt");
  const shapeKey = normalizeBrowShape(shapeEnum.value);
  const archScore = eyebrowArchScoreForMatrix(shapeKey);
  const shapeDisplay =
    shapeEnum.value && !isUnknownEnumValue(shapeEnum.value)
      ? formatAggregateDisplayValue(
          "eye_brows",
          "geometry_and_shape.eyebrow_shape",
          shapeEnum.value,
          locale,
        )
      : null;
  const tiltDisplay =
    tiltEnum.value && !isUnknownEnumValue(tiltEnum.value)
      ? formatAggregateDisplayValue(
          "eye_brows",
          "geometry_and_shape.eyebrow_tilt",
          tiltEnum.value,
          locale,
        )
      : null;

  return (
    <div className="space-y-4">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Brow profile", fr: "Profil des sourcils" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {overall.argument ??
              symmetry.argument ??
              i18n(language, {
                en: "Shape, tilt, symmetry and frame around the eyes.",
                fr: "Forme, inclinaison, symétrie et cadre autour des yeux.",
              })}
          </p>
        </div>
      </div>
      <div className="w-full min-w-0">
        <EyebrowBoldFeminineMatrix
          thickness={thickness.score}
          density={density.score}
          archScore={archScore}
          language={language}
          compact
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {shapeDisplay ? (
          <StatChip
            label={i18n(language, { en: "Shape", fr: "Forme" })}
            value={shapeDisplay}
          />
        ) : null}
        {tiltDisplay ? (
          <StatChip
            label={i18n(language, { en: "Tilt", fr: "Inclinaison" })}
            value={tiltDisplay}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------- Smile ------------------------------------- */

function SmilePreview({ aggregates, language }: PreviewProps) {
  const previewJob = React.useContext(AnalysisJobScanPreviewContext);
  const smileTeethGuideSrc =
    previewJob !== null
      ? buildAnalysisJobAssetPreviewUrl({
          jobId: previewJob.jobId,
          userId: previewJob.userId,
          assetTypeCode: "GUIDE_TRACE_SMILE_TEETH",
        })
      : null;
  const overallNested = getScore(aggregates, "global_score.overall_smile_score");
  const overallFlat = getScore(aggregates, "overall_smile_score");
  const overallLegacy = getScore(aggregates, "overall_smile");
  const summaryArg =
    overallNested.argument ??
    overallFlat.argument ??
    overallLegacy.argument;

  const whiteness = getScore(aggregates, "dental_quality.shade_and_whiteness");
  const integrity = getScore(aggregates, "dental_quality.surface_integrity");
  const proportions = getScore(aggregates, "dental_quality.tooth_proportions");
  const alignment = getScore(aggregates, "smile_architecture.dental_alignment");

  const shadePct =
    whiteness.score !== null
      ? (Math.max(0, Math.min(whiteness.score, 10)) / 10) * 100
      : null;

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Tooth shade", fr: "Teinte des dents" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {summaryArg ??
              whiteness.argument ??
              i18n(language, {
                en: "Whiteness, integrity, proportions and alignment.",
                fr: "Blancheur, intégrité, proportions et alignement.",
              })}
          </p>
        </div>
      </div>
      {shadePct !== null ? (
        <div className="space-y-1.5">
          <div className="relative h-8 overflow-hidden rounded-lg border border-white/15">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, #b59364 0%, #d2b06f 18%, #e8d18a 38%, #f3e2b1 58%, #faecc8 75%, #ffffff 100%)",
              }}
            />
            <div
              className="pointer-events-none absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
              style={{ left: `${shadePct}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
            <span>{i18n(language, { en: "Yellow", fr: "Jauni" })}</span>
            <span>{i18n(language, { en: "Pearly white", fr: "Blanc nacré" })}</span>
          </div>
        </div>
      ) : null}
      <div className="flex w-full shrink-0 justify-center">
        <AnalysisJobAssetPreviewThumb
          src={smileTeethGuideSrc}
          alt={i18n(language, {
            en: "Smile pose scan overlay: teeth guide trace",
            fr: "Repère sourire — dents (overlay)",
          })}
          imgFit="contain"
          className="w-fit max-w-[min(100%,22rem)] shrink-0"
          imgClassName="max-h-[13rem] sm:max-h-[15rem]"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniBar
          label={i18n(language, { en: "Integrity", fr: "Intégrité" })}
          score={integrity.score}
        />
        <MiniBar
          label={i18n(language, { en: "Proportions", fr: "Proportions" })}
          score={proportions.score}
        />
        <MiniBar
          label={i18n(language, { en: "Alignment", fr: "Alignement" })}
          score={alignment.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Cheeks ------------------------------------- */

function CheeksPreview({ aggregates, language }: PreviewProps) {
  const primaryOverall = getScore(
    aggregates,
    "global_score.overall_cheek_score",
  );
  const overall =
    primaryOverall.score !== null || primaryOverall.argument
      ? primaryOverall
      : getScore(aggregates, "overall_cheek");
  const bizygomatic = getScore(
    aggregates,
    "frontal_structure.bizygomatic_width",
  );
  const malarProminence = getScore(
    aggregates,
    "frontal_structure.malar_eminence_prominence",
  );
  const cheekSymmetry = getScore(
    aggregates,
    "frontal_structure.cheek_symmetry",
  );
  const heightPeak = getScore(
    aggregates,
    "profile_structure.cheekbone_height_peak",
  );
  const projectionArch = getScore(
    aggregates,
    "profile_structure.zygomatic_projection_and_arch",
  );
  const ogee = getScore(aggregates, "profile_structure.ogee_curve");
  const midfaceDominance = getScore(aggregates, "harmony.midface_dominance");

  const radarLabels: Record<string, { en: string; fr: string }> = {
    "frontal_structure.bizygomatic_width": { en: "Width", fr: "Largeur" },
    "frontal_structure.malar_eminence_prominence": {
      en: "Malar",
      fr: "Malaire",
    },
    "frontal_structure.cheek_symmetry": { en: "Symmetry", fr: "Symétrie" },
    "profile_structure.cheekbone_height_peak": {
      en: "Height",
      fr: "Hauteur",
    },
    "profile_structure.zygomatic_projection_and_arch": {
      en: "Zyg. arch",
      fr: "Arc zygom.",
    },
    "profile_structure.ogee_curve": { en: "Ogee", fr: "Ogee" },
    "harmony.midface_dominance": { en: "Midface", fr: "Midface" },
  };

  const radarSource: { key: string; score: number | null }[] = [
    { key: "frontal_structure.bizygomatic_width", score: bizygomatic.score },
    {
      key: "frontal_structure.malar_eminence_prominence",
      score: malarProminence.score,
    },
    { key: "frontal_structure.cheek_symmetry", score: cheekSymmetry.score },
    { key: "profile_structure.cheekbone_height_peak", score: heightPeak.score },
    {
      key: "profile_structure.zygomatic_projection_and_arch",
      score: projectionArch.score,
    },
    { key: "profile_structure.ogee_curve", score: ogee.score },
    { key: "harmony.midface_dominance", score: midfaceDominance.score },
  ];

  const radarData: WorkerSignatureRadarPoint[] = radarSource.flatMap((d) =>
    d.score === null
      ? []
      : [{ label: i18n(language, radarLabels[d.key]), score: d.score }],
  );

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO_SIGNATURE_RADAR}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Cheekbones", fr: "Pommettes" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-3">
            {projectionArch.argument ??
              overall.argument ??
              heightPeak.argument ??
              i18n(language, {
                en: "Frontal and profile structure of the midface.",
                fr: "Structure frontale et de profil du midface.",
              })}
          </p>
        </div>
        <div className="flex w-full justify-center px-0 sm:px-1">
          {radarData.length >= 3 ? (
            <WorkerSignatureRadar
              data={radarData}
              ariaLabel={i18n(language, {
                en: "Cheek signature radar",
                fr: "Radar de signature des pommettes",
              })}
              sizePreset="large"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- Hair ------------------------------------- */

function HairPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overall = getScore(aggregates, "global_score.overall_hair_score");
  const density = getScore(aggregates, "hair_quality_and_health.density");
  const shineDry = getScore(
    aggregates,
    "hair_quality_and_health.shine_and_dryness",
  );
  const health = getScore(
    aggregates,
    "hair_quality_and_health.health_appearance",
  );
  const groomingQuality = getScore(
    aggregates,
    "grooming_and_haircut.grooming_quality",
  );
  const haircutControl = getScore(
    aggregates,
    "grooming_and_haircut.haircut_control",
  );
  const textureEnum = getEnum(aggregates, "hair_characteristics.texture_type");
  const textureDisplay =
    textureEnum.value && !isUnknownEnumValue(textureEnum.value)
      ? formatAggregateDisplayValue(
          "hair",
          "hair_characteristics.texture_type",
          textureEnum.value,
          locale,
        )
      : null;

  const showGroomingCutMatrix = hasAnyScore(
    groomingQuality.score,
    haircutControl.score,
  );

  return (
    <div className="space-y-4">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Hair quality", fr: "Qualité capillaire" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {overall.argument ??
              density.argument ??
              i18n(language, {
                en: "Density, shine balance, health and texture.",
                fr: "Densité, équilibre brillance/sécheresse, santé et texture.",
              })}
          </p>
          {textureDisplay ? (
            <div className="mt-1.5 flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                {i18n(language, { en: "Texture", fr: "Texture" })}{" "}
                <span className="text-white">{textureDisplay}</span>
              </span>
            </div>
          ) : null}
        </div>
      </div>
      {showGroomingCutMatrix ? (
        <div className="w-full min-w-0">
          <WorkerStanceMatrix
            xScore={groomingQuality.score}
            yScore={haircutControl.score}
            xLeft={{
              en: "Rough upkeep",
              fr: "Toilettage négligé",
            }}
            xRight={{
              en: "Polished upkeep",
              fr: "Toilettage soigné",
            }}
            yBottom={{
              en: "Loose cut",
              fr: "Coupe peu maîtrisée",
            }}
            yTop={{
              en: "Sharp cut",
              fr: "Coupe maîtrisée",
            }}
            language={language}
            ariaLabel={{
              en: "Grooming and haircut stance matrix",
              fr: "Matrice toilettage et coupe",
            }}
            compact
            quadrantPalette="performance"
          />
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <MiniBar
          label={i18n(language, { en: "Density", fr: "Densité" })}
          score={density.score}
        />
        <MiniBar
          label={i18n(language, { en: "Shine & dryness", fr: "Brillance / sécheresse" })}
          score={shineDry.score}
        />
        <MiniBar
          label={i18n(language, { en: "Health", fr: "Santé" })}
          score={health.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Skin tint ------------------------------------- */

function SkinTintPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overallNested = getScore(aggregates, "global_score.overall_colorimetry_score");
  const overallFlat = getScore(aggregates, "overall_colorimetry_score");
  const overallLegacy = getScore(aggregates, "overall_colorimetry");
  const summaryArg =
    overallNested.argument ??
    overallFlat.argument ??
    overallLegacy.argument;
  const fitzEnum = getEnum(
    aggregates,
    "phenotype_and_undertone.fitzpatrick_type",
  );
  const undertoneEnum = getEnum(
    aggregates,
    "phenotype_and_undertone.skin_undertone",
  );
  const radiance = getScore(
    aggregates,
    "vitality_and_radiance.color_radiance_glow",
  );
  const sallowness = getScore(
    aggregates,
    "vitality_and_radiance.sallowness_absence",
  );
  const tanUniformity = getScore(
    aggregates,
    "sun_exposure_aesthetic.tan_uniformity",
  );
  const tanHarmony = getScore(
    aggregates,
    "sun_exposure_aesthetic.tan_phototype_harmony",
  );
  const tanLevel = getEnum(aggregates, "sun_exposure_aesthetic.tan_level");

  const fitzKey = fitzpatrickKey(fitzEnum.value);
  const fitzColor = fitzKey ? FITZPATRICK_HEX[fitzKey] : null;
  const fitzDisplay =
    fitzEnum.value && !isUnknownEnumValue(fitzEnum.value)
      ? formatAggregateDisplayValue(
          "skin_tint",
          "phenotype_and_undertone.fitzpatrick_type",
          fitzEnum.value,
          locale,
        ) ?? fitzEnum.value
      : null;
  const undertoneDisplay =
    undertoneEnum.value && !isUnknownEnumValue(undertoneEnum.value)
      ? formatAggregateDisplayValue(
          "skin_tint",
          "phenotype_and_undertone.skin_undertone",
          undertoneEnum.value,
          locale,
        ) ?? undertoneEnum.value
      : null;

  const tanLevelDisplay =
    tanLevel.value && !isUnknownEnumValue(tanLevel.value)
      ? formatAggregateDisplayValue(
          "skin_tint",
          "sun_exposure_aesthetic.tan_level",
          tanLevel.value,
          locale,
        ) ?? tanLevel.value
      : null;

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={`${PREVIEW_COPY} flex w-full flex-col items-center gap-2`}>
          {fitzColor ? (
            <ColorChip
              color={fitzColor}
              label={i18n(language, {
                en: "Natural depth (I–VI)",
                fr: "Niveau naturel (I–VI)",
              })}
              value={fitzDisplay}
            />
          ) : null}
          {undertoneDisplay ? (
            <StatChip
              label={i18n(language, {
                en: "Undertone hint",
                fr: "Reflet du teint",
              })}
              value={undertoneDisplay}
            />
          ) : null}
          {tanLevelDisplay ? (
            <StatChip
              label={i18n(language, { en: "Tan level", fr: "Niveau de bronzage" })}
              value={tanLevelDisplay}
            />
          ) : null}
          {summaryArg ? (
            <p className="mt-0.5 w-full text-center text-xs leading-snug text-zinc-400 line-clamp-2">
              {summaryArg}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniBar
          label={i18n(language, { en: "Radiance", fr: "Éclat" })}
          score={radiance.score}
        />
        <MiniBar
          label={i18n(language, { en: "Vitality", fr: "Vitalité" })}
          score={sallowness.score}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniBar
          label={i18n(language, { en: "Tan even", fr: "Bronzage homogène" })}
          score={tanUniformity.score}
        />
        <MiniBar
          label={i18n(language, { en: "Tan fit", fr: "Harmonie phototype" })}
          score={tanHarmony.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Neck ------------------------------------- */

function NeckPreview({ aggregates, language }: PreviewProps) {
  const length = getScore(aggregates, "dimensions_and_proportions.neck_length");
  const width = getScore(aggregates, "dimensions_and_proportions.neck_width");
  const shapeTaper = getScore(
    aggregates,
    "dimensions_and_proportions.neck_shape_and_taper",
  );
  const scm = getScore(
    aggregates,
    "musculature_and_soft_tissue.scm_muscle_definition",
  );
  const firmness = getScore(
    aggregates,
    "musculature_and_soft_tissue.neck_firmness",
  );

  const showFirmDefinedMatrix =
    scm.score !== null && firmness.score !== null;

  return (
    <div className="space-y-4">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Neck profile", fr: "Profil du cou" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {length.argument ??
              i18n(language, {
                en: "Length, width, shape, SCM and tissue firmness.",
                fr: "Longueur, largeur, forme, SCM et fermeté des tissus.",
              })}
          </p>
        </div>
      </div>
      {showFirmDefinedMatrix ? (
        <div className="space-y-2">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, {
              en: "SCM × firmness",
              fr: "SCM × fermeté",
            })}
          </p>
          <div className="w-full min-w-0">
            <WorkerStanceMatrix
              xScore={scm.score}
              yScore={firmness.score}
              xLeft={{
                en: "Soft",
                fr: "Doux",
              }}
              xRight={{
                en: "Defined",
                fr: "Défini",
              }}
              yBottom={{
                en: "Lax",
                fr: "Relâché",
              }}
              yTop={{
                en: "Firm",
                fr: "Ferme",
              }}
              language={language}
              ariaLabel={{
                en: "Neck composition matrix",
                fr: "Matrice de composition du cou",
              }}
              compact
              quadrantPalette="performance"
            />
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <MiniBar
          label={i18n(language, { en: "Length", fr: "Longueur" })}
          score={length.score}
        />
        <MiniBar
          label={i18n(language, { en: "Width", fr: "Largeur" })}
          score={width.score}
        />
        <MiniBar
          label={i18n(language, { en: "Shape", fr: "Forme" })}
          score={shapeTaper.score}
        />
        <MiniBar
          label={i18n(language, { en: "SCM", fr: "SCM" })}
          score={scm.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Lips ------------------------------------- */

function LipsPreview({ aggregates, language }: PreviewProps) {
  const previewJob = React.useContext(AnalysisJobScanPreviewContext);
  const faceFrontLipsGuideSrc =
    previewJob !== null
      ? buildAnalysisJobAssetPreviewUrl({
          jobId: previewJob.jobId,
          userId: previewJob.userId,
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_LIPS",
        })
      : null;
  const smileLipsGuideSrc =
    previewJob !== null
      ? buildAnalysisJobAssetPreviewUrl({
          jobId: previewJob.jobId,
          userId: previewJob.userId,
          assetTypeCode: "GUIDE_TRACE_SMILE_LIPS",
        })
      : null;
  const fullness = getScore(aggregates, "proportions_and_width.lip_fullness");
  const ratio = getScore(aggregates, "proportions_and_width.upper_lower_ratio");
  const widthScore = getScore(aggregates, "proportions_and_width.lip_width");

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Lips", fr: "Lèvres" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {fullness.argument ??
              i18n(language, {
                en: "Fullness, ratio, width and color signature.",
                fr: "Volume, ratio, largeur et signature couleur.",
              })}
          </p>
        </div>
      </div>
      {(faceFrontLipsGuideSrc || smileLipsGuideSrc) ? (
        <div
          className="mx-auto grid w-full max-w-[min(100%,44rem)] grid-cols-2 gap-2 sm:gap-3"
          aria-label={i18n(language, {
            en: "Lip guide traces: front resting face, smile pose",
            fr: "Repères lèvres : face au repos, prise sourire",
          })}
        >
          <div className="flex justify-center">
            <AnalysisJobAssetPreviewThumb
              src={faceFrontLipsGuideSrc}
              alt={i18n(language, {
                en: "Front-face scan overlay: lips at rest guide",
                fr: "Repère lèvres au repos — prise frontale",
              })}
              imgFit="contain"
              className="w-fit max-w-full shrink-0"
              imgClassName="max-h-[13rem] sm:max-h-[15rem]"
            />
          </div>
          <div className="flex justify-center">
            <AnalysisJobAssetPreviewThumb
              src={smileLipsGuideSrc}
              alt={i18n(language, {
                en: "Smile pose scan overlay: lip contour guide",
                fr: "Repère lèvres — prise de vue sourire",
              })}
              imgFit="contain"
              className="w-fit max-w-full shrink-0"
              imgClassName="max-h-[13rem] sm:max-h-[15rem]"
            />
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <MiniBar
          label={i18n(language, { en: "Fullness", fr: "Volume" })}
          score={fullness.score}
        />
        <MiniBar
          label={i18n(language, { en: "Up / Low", fr: "Sup / Inf" })}
          score={ratio.score}
        />
        <MiniBar
          label={i18n(language, { en: "Width", fr: "Largeur" })}
          score={widthScore.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Chin ------------------------------------- */

function ChinPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const contour = getScore(aggregates, "shape_and_contour.chin_contour");
  const projection = getScore(
    aggregates,
    "projection_and_profile.chin_projection",
  );
  const height = getScore(aggregates, "projection_and_profile.chin_height");
  const width = getScore(aggregates, "width_and_integration.chin_width");
  const lowerFaceIntegration = getScore(
    aggregates,
    "width_and_integration.lower_face_integration",
  );
  const shapeEnum = getEnum(aggregates, "shape_and_contour.chin_shape");
  const shapeDisplay =
    shapeEnum.value && !isUnknownEnumValue(shapeEnum.value)
      ? formatAggregateDisplayValue(
          "chin",
          "shape_and_contour.chin_shape",
          shapeEnum.value,
          locale,
        ) ?? shapeEnum.value
      : null;

  const radarLabels: Record<string, { en: string; fr: string }> = {
    "shape_and_contour.chin_contour": { en: "Contour", fr: "Contour" },
    "projection_and_profile.chin_projection": {
      en: "Projection",
      fr: "Projection",
    },
    "projection_and_profile.chin_height": { en: "Height", fr: "Hauteur" },
    "width_and_integration.chin_width": { en: "Width", fr: "Largeur" },
    "width_and_integration.lower_face_integration": {
      en: "Lower-face fit",
      fr: "Intégration\nbas visage",
    },
  };

  const radarSource: { key: string; score: number | null }[] = [
    { key: "shape_and_contour.chin_contour", score: contour.score },
    { key: "projection_and_profile.chin_projection", score: projection.score },
    { key: "projection_and_profile.chin_height", score: height.score },
    { key: "width_and_integration.chin_width", score: width.score },
    {
      key: "width_and_integration.lower_face_integration",
      score: lowerFaceIntegration.score,
    },
  ];

  const radarData: WorkerSignatureRadarPoint[] = radarSource.flatMap((d) =>
    d.score === null
      ? []
      : [{ label: i18n(language, radarLabels[d.key]), score: d.score }],
  );

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO_SIGNATURE_RADAR}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Chin shape", fr: "Forme du menton" })}
          </p>
          <p className="mt-1 font-display text-base font-bold text-white">
            {shapeDisplay ?? "—"}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-zinc-400 line-clamp-3">
            {contour.argument ??
              projection.argument ??
              i18n(language, {
                en: "Contour, projection, width and lower-face integration.",
                fr: "Contour, projection, largeur et intégration du bas du visage.",
              })}
          </p>
        </div>
        <div className="flex w-full justify-center px-0 sm:px-1">
          {radarData.length >= 3 ? (
            <WorkerSignatureRadar
              data={radarData}
              ariaLabel={i18n(language, {
                en: "Chin signature radar",
                fr: "Radar de signature menton",
              })}
              sizePreset="large"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- Nose ------------------------------------- */

function NosePreview({ aggregates, language }: PreviewProps) {
  const previewJob = React.useContext(AnalysisJobScanPreviewContext);
  const noseMouthGuideSrc =
    previewJob !== null
      ? buildAnalysisJobAssetPreviewUrl({
          jobId: previewJob.jobId,
          userId: previewJob.userId,
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH",
        })
      : null;
  const symmetry = getScore(
    aggregates,
    "frontal_symmetry_and_width.nose_symmetry",
  );
  const alarWidth = getScore(
    aggregates,
    "frontal_symmetry_and_width.overall_alar_width",
  );
  const bridgeWidth = getScore(
    aggregates,
    "frontal_symmetry_and_width.bridge_width",
  );
  const tipDef = getScore(
    aggregates,
    "tip_morphology.tip_definition",
  );

  // If all key signals are missing, show a partial-data hint
  const hasAny =
    [symmetry.score, alarWidth.score, bridgeWidth.score, tipDef.score].some(
      (s) => s !== null,
    );

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Nose profile", fr: "Profil du nez" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {symmetry.argument ??
              i18n(language, {
                en: "Bridge, alars, tip and frontal symmetry.",
                fr: "Arête, ailes, pointe et symétrie frontale.",
              })}
          </p>
        </div>
      </div>
      <div className="flex w-full shrink-0 justify-center">
        <AnalysisJobAssetPreviewThumb
          src={noseMouthGuideSrc}
          alt={i18n(language, {
            en: "Scan overlay: frontal nose and mouth guide trace",
            fr: "Repère scan face — nez et bouche",
          })}
          className="h-[15rem] w-48 shrink-0 sm:h-52 sm:w-44"
          imgClassName={PREVIEW_SYM_SCAN_IMG_CLASSNAME}
        />
      </div>
      {hasAny ? (
        <div className="grid grid-cols-2 gap-2">
          <MiniBar
            label={i18n(language, { en: "Symmetry", fr: "Symétrie" })}
            score={symmetry.score}
          />
          <MiniBar
            label={i18n(language, { en: "Alar width", fr: "Ailes" })}
            score={alarWidth.score}
          />
          <MiniBar
            label={i18n(language, { en: "Bridge width", fr: "Arête" })}
            score={bridgeWidth.score}
          />
          <MiniBar
            label={i18n(language, { en: "Tip definition", fr: "Pointe" })}
            score={tipDef.score}
          />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-400">
          {i18n(language, {
            en: "Partial data — open the worker for the full analysis.",
            fr: "Données partielles — ouvre le worker pour l'analyse complète.",
          })}
        </p>
      )}
    </div>
  );
}

/* ----------------------------------- Eyes ------------------------------------- */

function EyesPreview({ aggregates, language }: PreviewProps) {
  const previewJob = React.useContext(AnalysisJobScanPreviewContext);
  const eyeCloseupContoursSrc =
    previewJob !== null
      ? buildAnalysisJobAssetPreviewUrl({
          jobId: previewJob.jobId,
          userId: previewJob.userId,
          assetTypeCode: "GUIDE_TRACE_EYE_CLOSEUP_CONTOURS",
        })
      : null;
  const eyeCloseupCanthalTiltSrc =
    previewJob !== null
      ? buildAnalysisJobAssetPreviewUrl({
          jobId: previewJob.jobId,
          userId: previewJob.userId,
          assetTypeCode: "GUIDE_TRACE_EYE_CANTHAL_TILT",
        })
      : null;
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overall = getScore(aggregates, "global_score.overall_eye_score");
  const symmetry = getScore(aggregates, "morphology_and_tilt.eye_symmetry");
  const support = getScore(aggregates, "under_eye_health.under_eye_support");
  const lashes = getScore(aggregates, "iris_sclera_and_lashes.eyelash_density");
  const tiltEnum = getEnum(aggregates, "morphology_and_tilt.canthal_tilt");
  const irisEnum = getEnum(aggregates, "iris_sclera_and_lashes.iris_color");

  const tiltDisplay =
    tiltEnum.value && !isUnknownEnumValue(tiltEnum.value)
      ? formatAggregateDisplayValue(
          "eyes",
          "morphology_and_tilt.canthal_tilt",
          tiltEnum.value,
          locale,
        ) ?? tiltEnum.value
      : null;

  const irisKey = normalizeKey(irisEnum.value);
  const irisHex = irisKey ? IRIS_COLOR_HEX[irisKey] : null;

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Eyes", fr: "Yeux" })}
          </p>
          <p className="mt-1 font-display text-base font-bold text-white">
            {overall.score !== null ? overall.score.toFixed(1) : "—"}
            <span className="ml-1 text-sm font-semibold text-zinc-400">/10</span>
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-400 line-clamp-2">
            {overall.argument ??
              i18n(language, {
                en: "Canthal tilt, spacing, symmetry, lids and iris color.",
                fr: "Inclinaison canthale, espacement, symétrie, paupières et couleur de l'iris.",
              })}
          </p>
        </div>
        {irisHex ? (
          <div
            className="mx-auto h-10 w-10 shrink-0 rounded-full ring-2 ring-white/30"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${irisHex} 0%, ${irisHex} 60%, rgba(0,0,0,0.6) 100%)`,
            }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="flex w-full shrink-0 flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <AnalysisJobAssetPreviewThumb
          src={eyeCloseupContoursSrc}
          alt={i18n(language, {
            en: "Eye close-up scan overlay: contour guide trace",
            fr: "Repère gros plan œil — contours",
          })}
          imgFit="contain"
          className="w-fit max-w-[min(100%,22rem)] shrink-0"
          imgClassName="max-h-[13rem] sm:max-h-[15rem]"
        />
        <AnalysisJobAssetPreviewThumb
          src={eyeCloseupCanthalTiltSrc}
          alt={i18n(language, {
            en: "Eye close-up: canthal tilt guide trace",
            fr: "Repère gros plan œil — canthal tilt",
          })}
          imgFit="contain"
          className="w-fit max-w-[min(100%,22rem)] shrink-0"
          imgClassName="max-h-[13rem] sm:max-h-[15rem]"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiltDisplay ? (
          <StatChip
            label={i18n(language, { en: "Canthal tilt", fr: "Inclinaison" })}
            value={tiltDisplay}
          />
        ) : null}
        <MiniBar
          label={i18n(language, { en: "Symmetry", fr: "Symétrie" })}
          score={symmetry.score}
        />
        <MiniBar
          label={i18n(language, { en: "Under-eye", fr: "Sous-yeux" })}
          score={support.score}
        />
        <MiniBar
          label={i18n(language, { en: "Lashes", fr: "Cils" })}
          score={lashes.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Age ------------------------------------- */

function AgePreview({ aggregates, language }: PreviewProps) {
  const age = extractAge(aggregates);
  const argument = extractAgeArgument(aggregates);

  return (
    <div className="flex w-full flex-col items-stretch gap-4">
      <div className={`${PREVIEW_HERO} px-1`}>
        <div className="w-full max-w-none px-1 text-center text-balance">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Apparent age", fr: "Âge apparent" })}
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">
            {age !== null ? Math.round(age) : "—"}
            <span className="ml-1.5 text-lg font-semibold text-zinc-400">
              {i18n(language, { en: "yrs", fr: "ans" })}
            </span>
          </p>
          {argument ? (
            <p className="mt-3 w-full max-w-none text-left text-xs leading-relaxed tracking-normal text-zinc-300 [text-wrap:pretty] whitespace-pre-wrap break-words">
              {argument}
            </p>
          ) : (
            <p className="mt-3 text-left text-xs leading-relaxed text-zinc-400">
              {i18n(language, {
                en: "Estimated from your portrait — lighting and angle can skew the reading.",
                fr: "Estimé depuis ton portrait — lumière et angle peuvent biaiser la lecture.",
              })}
            </p>
          )}
        </div>
      </div>
      {age !== null ? (
        <div className="w-full shrink-0 px-0.5 pb-1">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            {i18n(language, {
              en: "Maturity spectrum",
              fr: "Spectre maturité",
            })}
          </p>
          <MaturityTimeline age={age} language={language} />
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------- Generic fallback ------------------------------------- */

function GenericPreview({
  worker,
  aggregates,
  language,
}: PreviewProps & { worker: string }) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  // Try to find a "score" + "argument" pair to feature, plus 3 mini bars.
  const numericKeys: { key: string; score: number }[] = [];
  for (const key of Object.keys(aggregates)) {
    if (key.endsWith(".score") || key.endsWith(".argument")) continue;
    const v = aggregates[key];
    const n = typeof v === "number" ? v : getNumber(aggregates, key);
    if (n !== null && n >= 0 && n <= 10) {
      numericKeys.push({ key, score: n });
    }
  }
  // Look for a {base}.score / {base}.argument pair
  const seen = new Set<string>();
  for (const key of Object.keys(aggregates)) {
    if (!key.endsWith(".score")) continue;
    const base = key.slice(0, -".score".length);
    if (seen.has(base)) continue;
    seen.add(base);
    const score = getScore(aggregates, base).score;
    if (score !== null && !numericKeys.find((n) => n.key === base)) {
      numericKeys.push({ key: base, score });
    }
  }
  const hero = numericKeys[0] ?? null;
  const rest = numericKeys.slice(1, 4);
  const heroLabel = hero
    ? formatAggregateDisplayLabel(worker, hero.key, locale)
    : null;
  const heroArg = hero
    ? getString(aggregates, `${hero.key}.argument`)
    : null;

  if (numericKeys.length === 0) {
    return <EmptyPreview language={language} />;
  }

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          {heroLabel ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {heroLabel}
            </p>
          ) : null}
          {heroArg ? (
            <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-3">
              {heroArg}
            </p>
          ) : null}
        </div>
      </div>
      {rest.length ? (
        <div
          className={`grid gap-2 ${
            rest.length === 1
              ? "grid-cols-1"
              : rest.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
          }`}
        >
          {rest.map((r) => (
            <MiniBar
              key={r.key}
              label={formatAggregateDisplayLabel(worker, r.key, locale)}
              score={r.score}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Headline ring on overview worker cards — matches {@link calculateWorkerFaceScore}
 * for weighted workers; otherwise mean of leaf metrics (e.g. age).
 */
export function getWorkerPreviewHeadlineScore(
  worker: string,
  aggregates: Record<string, unknown>,
): number | null {
  const weighted = calculateWorkerFaceScore(worker, aggregates);
  if (weighted !== null) {
    return weighted;
  }
  return computeMeanLeafScores10(aggregates, 1);
}

/* ============================================================================
 * Dispatcher
 * ========================================================================= */

export function WorkerPreviewContent({
  worker,
  aggregates,
  language,
}: {
  worker: string;
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}) {
  switch (worker) {
    case "coloring":
      return <ColoringPreview aggregates={aggregates} language={language} />;
    case "skin":
      return <SkinPreview aggregates={aggregates} language={language} />;
    case "bodyfat":
      return <BodyfatPreview aggregates={aggregates} language={language} />;
    case "symmetry_shape":
      return (
        <SymmetryShapePreview aggregates={aggregates} language={language} />
      );
    case "jaw":
      return <JawPreview aggregates={aggregates} language={language} />;
    case "eye_brows":
      return <BrowsPreview aggregates={aggregates} language={language} />;
    case "smile":
      return <SmilePreview aggregates={aggregates} language={language} />;
    case "cheeks":
      return <CheeksPreview aggregates={aggregates} language={language} />;
    case "hair":
      return <HairPreview aggregates={aggregates} language={language} />;
    case "skin_tint":
      return <SkinTintPreview aggregates={aggregates} language={language} />;
    case "neck":
      return <NeckPreview aggregates={aggregates} language={language} />;
    case "lips":
      return <LipsPreview aggregates={aggregates} language={language} />;
    case "chin":
      return <ChinPreview aggregates={aggregates} language={language} />;
    case "nose":
      return <NosePreview aggregates={aggregates} language={language} />;
    case "eyes":
      return <EyesPreview aggregates={aggregates} language={language} />;
    case "age":
      return <AgePreview aggregates={aggregates} language={language} />;
    default:
      return (
        <GenericPreview
          worker={worker}
          aggregates={aggregates}
          language={language}
        />
      );
  }
}
