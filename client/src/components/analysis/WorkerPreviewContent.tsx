import * as React from "react";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
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
  getEnum,
  getNumber,
  getScore,
  getString,
} from "./workers/_shared";

/* ============================================================================
 * Mini building blocks
 *
 * Smaller, denser primitives designed to fit inside a dashboard preview card.
 * They share the brand DA from `workers/_shared.tsx` (same gradients, same
 * quality-band semantics) so previews and detail pages feel cohesive.
 * ========================================================================= */

/** Centered preview hero: copy + visuals (headline score ring lives on the card title row). */
const PREVIEW_HERO = "flex w-full flex-col items-center gap-3 text-center";
/** Tighter stack so the skin radar sits closer to the copy (less dead vertical space). */
const PREVIEW_HERO_SKIN_RADAR = "flex w-full flex-col items-center gap-1 text-center";
const PREVIEW_COPY = "w-full max-w-md text-balance";

export type MiniRingHighlight = "default" | "strength" | "weakness";

export function MiniRing({
  score,
  scale = 10,
  size = 76,
  fractionDigits,
  highlight = "default",
}: {
  score: number;
  scale?: number;
  size?: number;
  fractionDigits?: number;
  /** Coloring for overview worker cards in top-3 strengths vs weaknesses. */
  highlight?: MiniRingHighlight;
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
    highlight === "strength"
      ? "#6ee7b7"
      : highlight === "weakness"
        ? "#fca5a5"
        : "#ffffff";

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
        stroke="rgba(255,255,255,0.08)"
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
  dark_brown: "#3a261a",
  medium_brown: "#6a4528",
  brown: "#6a4528",
  light_brown: "#a06f43",
  hazel: "#9a7a3f",
  amber: "#a06f1f",
  green: "#4f7d4f",
  blue_grey: "#7488a0",
  grey: "#9da4ad",
  blue: "#3d6a9c",
  light_blue: "#7cb1d6",
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
  "acne_and_scarring.atrophic_scarring": {
    en: "Scarring",
    fr: "Cicatrices",
  },
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

function SkinPreviewRadar({
  data,
  language,
}: {
  data: { label: string; score: number }[];
  language: AppLanguage;
}) {
  const gradientId = React.useId().replace(/:/g, "");
  /** Horizontal pad for long labels; slightly tighter vertically to reduce empty bands in the SVG. */
  const viewPadX = 70;
  const viewPadY = 56;
  const size = 320;
  const center = size / 2;
  const maxRadius = 106;
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
    const r = maxRadius + 30;
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
      className="mx-auto h-auto w-full max-w-[min(100%,440px)] shrink-0 overflow-visible"
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
          stroke="rgba(255,255,255,0.09)"
          strokeWidth="1"
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
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        );
      })}

      <polygon
        points={polygon}
        fill={`url(#${gradientId})`}
        stroke="#cfdde2"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {valuePoints.map((p, i) => {
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        return (
          <circle
            key={`pt-${i}`}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill={paint.dotFill}
            stroke={paint.dotStroke}
            strokeWidth="1.4"
          />
        );
      })}

      {/* Scale reference along bottom ray (0–10 toward perimeter) */}
      {[0, 2.5, 5, 7.5, 10].map((v) => {
        const ang = Math.PI / 2;
        const r = (v / 10) * maxRadius;
        const pad = v === 0 ? 16 : v === 10 ? 16 : 13;
        const xo = center + (r + pad) * Math.cos(ang);
        const yo = center + (r + pad) * Math.sin(ang);
        return (
          <text
            key={`tick-${v}`}
            x={xo}
            y={yo}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="8.25"
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
        return (
          <React.Fragment key={`label-${i}`}>
            <text
              x={lp.x}
              y={lp.y - 7}
              textAnchor={lp.anchor}
              dominantBaseline="middle"
              fontSize="10"
              fontWeight="600"
              fill={paint.labelFill}
              letterSpacing="0.03em"
            >
              {d.label}
            </text>
            <text
              x={lp.x}
              y={lp.y + 10}
              textAnchor={lp.anchor}
              dominantBaseline="middle"
              fontSize="9"
              fontWeight="700"
              fill={paint.previewScoreFill}
            >
              {scoreTxt}
              <tspan fill={paint.previewMutedFill} fontWeight="600">
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
  const global =
    getScore(aggregates, "overall_skin_score").score !== null
      ? getScore(aggregates, "overall_skin_score")
      : getScore(aggregates, "overall_skin");

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
  const activeAcne = getScore(aggregates, "acne_and_scarring.active_acne");
  const atrophicScarring = getScore(
    aggregates,
    "acne_and_scarring.atrophic_scarring",
  );
  const colorUniformity = getScore(
    aggregates,
    "pigmentation_and_tone.color_uniformity",
  );
  const redness = getScore(
    aggregates,
    "pigmentation_and_tone.redness_and_erythema",
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
      key: "texture_and_pores.pore_size_visibility",
      value: poreVisibility.score,
    },
    {
      key: "texture_and_pores.blackheads_and_congestion",
      value: blackheads.score,
    },
    {
      key: "texture_and_pores.surface_smoothness",
      value: surfaceSmoothness.score,
    },
    { key: "acne_and_scarring.active_acne", value: activeAcne.score },
    {
      key: "acne_and_scarring.atrophic_scarring",
      value: atrophicScarring.score,
    },
    {
      key: "pigmentation_and_tone.color_uniformity",
      value: colorUniformity.score,
    },
    {
      key: "pigmentation_and_tone.redness_and_erythema",
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
      <div className={PREVIEW_HERO_SKIN_RADAR}>
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
        <div className="flex w-full justify-center px-0.5">
          {radarData.length >= 3 ? (
            <SkinPreviewRadar data={radarData} language={language} />
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
    "body_fat_estimation.facial_leanness_score",
  );
  const tierEnum = getEnum(
    aggregates,
    "body_fat_estimation.visual_estimate_tier",
  );
  const tierDisplay = tierEnum.value
    ? formatAggregateDisplayValue(
        "bodyfat",
        "body_fat_estimation.visual_estimate_tier",
        tierEnum.value,
        locale,
      )
    : null;
  const sharpness = getBodyfatCompositionSharpness(aggregates);

  return (
    <div className="space-y-4">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Visual tier", fr: "Niveau visuel" })}
          </p>
          <p className="mt-1 font-display text-base font-bold text-white">
            {tierDisplay ?? "—"}
          </p>
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
          leanness={global.score}
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

const FACE_SHAPE_PATHS: Record<string, string> = {
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

function SymmetryShapePreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overall = getScore(aggregates, "overall_face_structure_score");
  const shapeEnum = getEnum(aggregates, "face_shape.shape");
  const shapeKey = normalizeKey(shapeEnum.value);
  const shapePath =
    shapeKey && FACE_SHAPE_PATHS[shapeKey]
      ? FACE_SHAPE_PATHS[shapeKey]
      : shapeKey === "long" || shapeKey === "rectangle"
        ? FACE_SHAPE_PATHS.oblong
        : null;
  const shapeDisplay = shapeEnum.value
    ? formatAggregateDisplayValue(
        "symmetry_shape",
        "face_shape.shape",
        shapeEnum.value,
        locale,
      )
    : null;

  const eyeSym = getScore(aggregates, "symmetry.eye_symmetry").score;
  const browSym = getScore(aggregates, "symmetry.brow_symmetry").score;
  const mouthSym = getScore(aggregates, "symmetry.mouth_symmetry").score;

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
            {overall.argument ??
              i18n(language, {
                en: "Morphology and bilateral symmetry synthesis.",
                fr: "Synthèse morphologie et symétrie bilatérale.",
              })}
          </p>
        </div>
        {shapePath ? (
          <svg
            viewBox="0 0 100 120"
            className="mx-auto h-20 w-16 shrink-0"
            aria-hidden="true"
          >
            <path
              d={shapePath}
              fill="rgba(233,241,244,0.85)"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1.4"
            />
          </svg>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniBar
          label={i18n(language, { en: "Eyes", fr: "Yeux" })}
          score={eyeSym}
        />
        <MiniBar
          label={i18n(language, { en: "Brows", fr: "Sourcils" })}
          score={browSym}
        />
        <MiniBar
          label={i18n(language, { en: "Mouth", fr: "Bouche" })}
          score={mouthSym}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Jaw ------------------------------------- */

function JawPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overall = getScore(aggregates, "overall_jaw");
  const definition = getScore(
    aggregates,
    "definition_and_contrast.jawline_definition",
  );
  const width = getScore(aggregates, "frontal_geometry.jaw_width");
  const cheekRatio = getScore(
    aggregates,
    "frontal_geometry.jaw_to_cheek_ratio",
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

  // Pick a matching jawline icon for the detected shape (default = tapered).
  const shapeKey = normalizeKey(shapeEnum.value);
  const jawIcons: Record<string, string> = {
    square: "M18 6 H82 V58 Q82 86 50 102 Q18 86 18 58 Z",
    round: "M22 6 H78 Q78 78 50 102 Q22 78 22 6 Z",
    tapered:
      "M22 6 H78 Q78 50 64 78 Q56 96 50 102 Q44 96 36 78 Q22 50 22 6 Z",
    effilée: "M22 6 H78 Q78 50 64 78 Q56 96 50 102 Q44 96 36 78 Q22 50 22 6 Z",
    oblong: "M22 6 H78 V70 Q78 92 50 104 Q22 92 22 70 Z",
    angular:
      "M22 6 H78 V52 L66 78 L52 100 L48 100 L34 78 L22 52 Z",
  };
  const iconPath =
    (shapeKey && jawIcons[shapeKey]) ?? jawIcons.tapered;

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Frontal jaw shape", fr: "Forme frontale" })}
          </p>
          <p className="mt-1 font-display text-base font-bold text-white">
            {shapeDisplay ?? "—"}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-400 line-clamp-2">
            {definition.argument ??
              i18n(language, {
                en: "Jawline reading combining shape, width and definition.",
                fr: "Lecture mâchoire : forme, largeur et définition.",
              })}
          </p>
        </div>
        <svg
          viewBox="0 0 100 110"
          className="mx-auto h-20 w-16 shrink-0"
          aria-hidden="true"
        >
          <path
            d={iconPath}
            fill="rgba(154,174,181,0.18)"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniBar
          label={i18n(language, { en: "Definition", fr: "Définition" })}
          score={definition.score}
        />
        <MiniBar
          label={i18n(language, { en: "Width", fr: "Largeur" })}
          score={width.score}
        />
        <MiniBar
          label={i18n(language, { en: "Jaw / cheek", fr: "Mâchoire / joues" })}
          score={cheekRatio.score}
        />
      </div>
    </div>
  );
}

/* ---------------------------------- Eyebrows ---------------------------------- */

function BrowsPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overall = getScore(aggregates, "overall_brow");
  const elevation = getScore(
    aggregates,
    "placement_and_spacing.elevation_brow_to_eye",
  );
  const symmetry = getScore(
    aggregates,
    "placement_and_spacing.eyebrow_symmetry",
  );
  const distance = getScore(
    aggregates,
    "placement_and_spacing.inter_brow_distance",
  );
  const shapeEnum = getEnum(aggregates, "geometry_and_tilt.eyebrow_shape");
  const tiltEnum = getEnum(aggregates, "geometry_and_tilt.eyebrow_tilt");
  const shapeDisplay =
    shapeEnum.value && !isUnknownEnumValue(shapeEnum.value)
      ? formatAggregateDisplayValue(
          "eye_brows",
          "geometry_and_tilt.eyebrow_shape",
          shapeEnum.value,
          locale,
        )
      : null;
  const tiltDisplay =
    tiltEnum.value && !isUnknownEnumValue(tiltEnum.value)
      ? formatAggregateDisplayValue(
          "eye_brows",
          "geometry_and_tilt.eyebrow_tilt",
          tiltEnum.value,
          locale,
        )
      : null;

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Brow profile", fr: "Profil des sourcils" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {symmetry.argument ??
              i18n(language, {
                en: "Shape, tilt, symmetry and frame around the eyes.",
                fr: "Forme, inclinaison, symétrie et cadre autour des yeux.",
              })}
          </p>
        </div>
        <svg
          viewBox="0 0 100 30"
          className="mx-auto h-12 w-24 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M5 22 Q 25 8 48 18"
            stroke="#e9f1f4"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M52 18 Q 75 8 95 22"
            stroke="#e9f1f4"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
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
      <div className="grid grid-cols-3 gap-2">
        <MiniBar
          label={i18n(language, { en: "Symmetry", fr: "Symétrie" })}
          score={symmetry.score}
        />
        <MiniBar
          label={i18n(language, { en: "Distance", fr: "Distance" })}
          score={distance.score}
        />
        <MiniBar
          label={i18n(language, { en: "Elevation", fr: "Hauteur" })}
          score={elevation.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Smile ------------------------------------- */

function SmilePreview({ aggregates, language }: PreviewProps) {
  const overall = getScore(aggregates, "overall_smile");
  const whiteness = getScore(aggregates, "dental_quality.shade_and_whiteness");
  const integrity = getScore(aggregates, "dental_quality.surface_integrity");
  const proportions = getScore(aggregates, "dental_quality.tooth_proportions");
  const alignment = getScore(aggregates, "smile_architecture.alignment");

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
            {whiteness.argument ??
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
  const overall = getScore(aggregates, "overall_cheek");
  const height = getScore(aggregates, "zygomatic_placement.cheekbone_height_peak");
  const width = getScore(aggregates, "zygomatic_placement.bizygomatic_width");
  const support = getScore(
    aggregates,
    "zygomatic_placement.cheek_to_eye_support",
  );
  const projection = getScore(
    aggregates,
    "projection_and_contour.zygomatic_projection",
  );

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Cheekbones", fr: "Pommettes" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-3">
            {projection.argument ??
              height.argument ??
              i18n(language, {
                en: "Placement, projection and support of the zygomatic.",
                fr: "Placement, projection et soutien des pommettes.",
              })}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniBar
          label={i18n(language, { en: "Height peak", fr: "Hauteur" })}
          score={height.score}
        />
        <MiniBar
          label={i18n(language, { en: "Width", fr: "Largeur" })}
          score={width.score}
        />
        <MiniBar
          label={i18n(language, { en: "Eye support", fr: "Soutien œil" })}
          score={support.score}
        />
        <MiniBar
          label={i18n(language, { en: "Projection", fr: "Projection" })}
          score={projection.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Hair ------------------------------------- */

function HairPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overall = getScore(aggregates, "overall_hair");
  const density = getScore(aggregates, "hair_quality.density");
  const thickness = getScore(aggregates, "hair_quality.strand_thickness");
  const shine = getScore(aggregates, "hair_quality.shine");
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

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Hair quality", fr: "Qualité capillaire" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {density.argument ??
              i18n(language, {
                en: "Density, thickness, shine and texture profile.",
                fr: "Densité, épaisseur, brillance et type de texture.",
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
      <div className="grid grid-cols-3 gap-2">
        <MiniBar
          label={i18n(language, { en: "Density", fr: "Densité" })}
          score={density.score}
        />
        <MiniBar
          label={i18n(language, { en: "Thickness", fr: "Épaisseur" })}
          score={thickness.score}
        />
        <MiniBar
          label={i18n(language, { en: "Shine", fr: "Brillance" })}
          score={shine.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Skin tint ------------------------------------- */

function SkinTintPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overall =
    getScore(aggregates, "overall_colorimetry_score").score !== null
      ? getScore(aggregates, "overall_colorimetry_score")
      : getScore(aggregates, "overall_colorimetry");
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

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={`${PREVIEW_COPY} flex w-full flex-col items-center gap-2`}>
          {fitzColor ? (
            <ColorChip
              color={fitzColor}
              label={i18n(language, { en: "Fitzpatrick", fr: "Fitzpatrick" })}
              value={fitzDisplay}
            />
          ) : null}
          {undertoneDisplay ? (
            <StatChip
              label={i18n(language, { en: "Undertone", fr: "Sous-ton" })}
              value={undertoneDisplay}
            />
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
    </div>
  );
}

/* ----------------------------------- Neck ------------------------------------- */

function NeckPreview({ aggregates, language }: PreviewProps) {
  const overall = getScore(aggregates, "overall_neck");
  const length = getScore(aggregates, "dimensions_and_proportions.neck_length");
  const width = getScore(aggregates, "dimensions_and_proportions.neck_width");
  const taper = getScore(aggregates, "dimensions_and_proportions.neck_taper");
  const definition = getScore(
    aggregates,
    "musculature_and_soft_tissue.muscle_definition",
  );

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Neck profile", fr: "Profil du cou" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {length.argument ??
              i18n(language, {
                en: "Length, width, taper and muscle definition.",
                fr: "Longueur, largeur, affinement et définition musculaire.",
              })}
          </p>
        </div>
        <svg
          viewBox="0 0 60 80"
          className="mx-auto h-16 w-12 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M18 4 H42 V32 Q42 56 30 76 Q18 56 18 32 Z"
            fill="rgba(154,174,181,0.18)"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.4"
          />
        </svg>
      </div>
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
          label={i18n(language, { en: "Taper", fr: "Affinement" })}
          score={taper.score}
        />
        <MiniBar
          label={i18n(language, { en: "Definition", fr: "Définition" })}
          score={definition.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Lips ------------------------------------- */

function LipsPreview({ aggregates, language }: PreviewProps) {
  const overall =
    getScore(aggregates, "overall_lip_score").score !== null
      ? getScore(aggregates, "overall_lip_score")
      : getScore(aggregates, "overall_lip");
  const fullness = getScore(aggregates, "proportions_and_width.lip_fullness");
  const ratio = getScore(aggregates, "proportions_and_width.upper_lower_ratio");
  const widthScore = getScore(aggregates, "proportions_and_width.lip_width");
  const lipColorEnum = getEnum(
    aggregates,
    "texture_and_color.exact_lip_color",
    "lip_color_phenotype.exact_lip_color",
  );

  const colorKey = normalizeKey(lipColorEnum.value);
  const lipHex = colorKey
    ? LIP_COLOR_HEX[colorKey] ??
      // soft fallback: try first word
      LIP_COLOR_HEX[colorKey.split("_")[0]]
    : null;

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
        <svg
          viewBox="0 0 80 50"
          className="mx-auto h-14 w-20 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M10 22 Q 22 8 40 18 Q 58 8 70 22 Q 60 38 40 38 Q 20 38 10 22 Z"
            fill={lipHex ?? "rgba(192,114,123,0.7)"}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M10 22 Q 30 26 40 24 Q 50 26 70 22"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="1"
            fill="none"
          />
        </svg>
      </div>
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
  const overall = getScore(aggregates, "overall_chin");
  const contour = getScore(aggregates, "shape_and_contour.chin_contour");
  const fullness = getScore(aggregates, "shape_and_contour.chin_fullness");
  const projection = getScore(
    aggregates,
    "projection_and_profile.chin_projection",
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

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Chin shape", fr: "Forme du menton" })}
          </p>
          <p className="mt-1 font-display text-base font-bold text-white">
            {shapeDisplay ?? "—"}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-400 line-clamp-2">
            {contour.argument ??
              i18n(language, {
                en: "Contour, fullness and projection of the chin.",
                fr: "Contour, volume et projection du menton.",
              })}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniBar
          label={i18n(language, { en: "Contour", fr: "Contour" })}
          score={contour.score}
        />
        <MiniBar
          label={i18n(language, { en: "Volume", fr: "Volume" })}
          score={fullness.score}
        />
        <MiniBar
          label={i18n(language, { en: "Projection", fr: "Projection" })}
          score={projection.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Nose ------------------------------------- */

function NosePreview({ aggregates, language }: PreviewProps) {
  const overall = getScore(aggregates, "overall_nose");
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
    "tip_morphology_and_projection.tip_definition",
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
        <svg
          viewBox="0 0 60 80"
          className="mx-auto h-16 w-12 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M30 6 Q 26 30 22 50 Q 18 64 30 70 Q 42 64 38 50 Q 34 30 30 6 Z"
            fill="rgba(154,174,181,0.18)"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.4"
          />
        </svg>
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

/* ----------------------------------- Ear ------------------------------------- */

function EarPreview({ aggregates, language }: PreviewProps) {
  const overall = getScore(aggregates, "overall_ear");
  const sizeHarmony = getScore(
    aggregates,
    "proportions_and_placement.size_harmony",
  );
  const placement = getScore(
    aggregates,
    "proportions_and_placement.vertical_placement",
  );
  const tilt = getScore(aggregates, "proportions_and_placement.axis_tilt");
  const symmetry = getScore(aggregates, "morphology.ear_symmetry");

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Ears", fr: "Oreilles" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {sizeHarmony.argument ??
              tilt.argument ??
              i18n(language, {
                en: "Placement, size harmony and axis tilt.",
                fr: "Placement, harmonie de taille et inclinaison.",
              })}
          </p>
        </div>
        <svg
          viewBox="0 0 60 80"
          className="mx-auto h-16 w-12 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M22 6 Q 50 6 50 36 Q 50 62 38 70 Q 28 76 22 64 Q 12 60 14 44 Q 14 18 22 6 Z"
            fill="rgba(154,174,181,0.18)"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.4"
          />
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniBar
          label={i18n(language, { en: "Size harmony", fr: "Harmonie" })}
          score={sizeHarmony.score}
        />
        <MiniBar
          label={i18n(language, { en: "Placement", fr: "Placement" })}
          score={placement.score}
        />
        <MiniBar
          label={i18n(language, { en: "Axis tilt", fr: "Inclinaison" })}
          score={tilt.score}
        />
        <MiniBar
          label={i18n(language, { en: "Symmetry", fr: "Symétrie" })}
          score={symmetry.score}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Eyes ------------------------------------- */

function EyesPreview({ aggregates, language }: PreviewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const overall = getScore(aggregates, "overall_eye_score");
  const symmetry = getScore(aggregates, "morphology_and_tilt.eye_symmetry");
  const support = getScore(aggregates, "under_eye_health.support_and_hollows");
  const lashes = getScore(aggregates, "details_and_color.eyelash_density");
  const shapeEnum = getEnum(aggregates, "morphology_and_tilt.eye_shape");
  const tiltEnum = getEnum(aggregates, "morphology_and_tilt.canthal_tilt");
  const irisEnum = getEnum(aggregates, "details_and_color.iris_color");

  const shapeDisplay =
    shapeEnum.value && !isUnknownEnumValue(shapeEnum.value)
      ? formatAggregateDisplayValue(
          "eyes",
          "morphology_and_tilt.eye_shape",
          shapeEnum.value,
          locale,
        ) ?? shapeEnum.value
      : null;
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
            {i18n(language, { en: "Eye shape", fr: "Forme des yeux" })}
          </p>
          <p className="mt-1 font-display text-base font-bold text-white">
            {shapeDisplay ?? "—"}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-400 line-clamp-2">
            {overall.argument ??
              i18n(language, {
                en: "Shape, canthal tilt, symmetry and iris color.",
                fr: "Forme, inclinaison canthale, symétrie et couleur de l'iris.",
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
    case "ear":
      return <EarPreview aggregates={aggregates} language={language} />;
    case "eyes":
      return <EyesPreview aggregates={aggregates} language={language} />;
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
