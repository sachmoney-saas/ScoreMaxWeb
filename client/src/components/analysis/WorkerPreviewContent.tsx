import * as React from "react";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  bandFromScore,
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

const RING_GRADIENT_ID = "scoremaxPreviewRingGradient";

/** Centered preview hero: global ring + copy (overview worker cards). */
const PREVIEW_HERO = "flex w-full flex-col items-center gap-3 text-center";
const PREVIEW_COPY = "w-full max-w-md text-balance";

function MiniRing({
  score,
  scale = 10,
  size = 76,
}: {
  score: number;
  scale?: number;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(score, scale));
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / scale) * circumference;
  return (
    <svg
      viewBox="0 0 72 72"
      width={size}
      height={size}
      className="shrink-0"
      role="img"
      aria-label={`Score ${clamped.toFixed(1)} sur ${scale}`}
    >
      <defs>
        <linearGradient id={RING_GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9aaeb5" />
          <stop offset="100%" stopColor="#e9f1f4" />
        </linearGradient>
      </defs>
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
        stroke={`url(#${RING_GRADIENT_ID})`}
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
        fill="#ffffff"
      >
        {clamped.toFixed(clamped % 1 === 0 ? 0 : 1)}
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
        {global.score !== null ? (
          <MiniRing score={global.score} />
        ) : (
          <div className="h-[76px] w-[76px]" aria-hidden />
        )}
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

function SkinMiniRadar({ scores }: { scores: number[] }) {
  const size = 96;
  const c = size / 2;
  const max = 38;
  const n = scores.length;
  if (n < 3) return null;
  const polar = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const r = (Math.max(0, Math.min(v, 10)) / 10) * max;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  const pts = scores.map((s, i) => polar(i, s));
  const polygon = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const grid = [0.33, 0.66, 1];
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-24 w-24 shrink-0"
      role="img"
      aria-label="Skin radar preview"
    >
      <defs>
        <linearGradient id="miniRadar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9aaeb5" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d6e4ff" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {grid.map((g) => (
        <circle
          key={g}
          cx={c}
          cy={c}
          r={g * max}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}
      {scores.map((_, i) => {
        const e = polar(i, 10);
        return (
          <line
            key={i}
            x1={c}
            y1={c}
            x2={e.x}
            y2={e.y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        );
      })}
      <polygon
        points={polygon}
        fill="url(#miniRadar)"
        stroke="#cfdde2"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SkinPreview({ aggregates, language }: PreviewProps) {
  const global =
    getScore(aggregates, "overall_skin_score").score !== null
      ? getScore(aggregates, "overall_skin_score")
      : getScore(aggregates, "overall_skin");
  const radarScores = [
    "texture_and_pores.pore_size_visibility",
    "texture_and_pores.surface_smoothness",
    "acne_and_scarring.active_acne",
    "pigmentation_and_tone.color_uniformity",
    "pigmentation_and_tone.redness_and_erythema",
    "hydration_and_vitality.firmness_and_elasticity",
  ]
    .map((k) => getScore(aggregates, k).score)
    .filter((v): v is number => v !== null);

  const pores = getScore(aggregates, "texture_and_pores.pore_size_visibility").score;
  const acne = getScore(aggregates, "acne_and_scarring.active_acne").score;
  const uniformity = getScore(
    aggregates,
    "pigmentation_and_tone.color_uniformity",
  ).score;

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        {global.score !== null ? <MiniRing score={global.score} /> : null}
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Skin radar", fr: "Radar peau" })}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-300 line-clamp-2">
            {global.argument ??
              i18n(language, {
                en: "Texture, blemishes and tone synthesis.",
                fr: "Synthèse texture, imperfections et teint.",
              })}
          </p>
        </div>
        <div className="flex w-full justify-center pt-1">
          <SkinMiniRadar scores={radarScores} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatChip
          label={i18n(language, { en: "Pores", fr: "Pores" })}
          value={pores !== null ? pores.toFixed(0) : "—"}
          band={pores !== null ? bandFromScore(pores) : null}
        />
        <StatChip
          label={i18n(language, { en: "Acne", fr: "Acné" })}
          value={acne !== null ? acne.toFixed(0) : "—"}
          band={acne !== null ? bandFromScore(acne) : null}
        />
        <StatChip
          label={i18n(language, { en: "Uniformity", fr: "Uniformité" })}
          value={uniformity !== null ? uniformity.toFixed(0) : "—"}
          band={uniformity !== null ? bandFromScore(uniformity) : null}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- Bodyfat ------------------------------------- */

const BODYFAT_TIERS = [
  { key: "obese", color: "#3a4a52", en: "Obese", fr: "Obèse" },
  { key: "overweight", color: "#536974", en: "Overweight", fr: "Surpoids" },
  { key: "average_soft", color: "#788d96", en: "Average", fr: "Moyen" },
  { key: "athletic_lean", color: "#9fb4bb", en: "Athletic", fr: "Athlétique" },
  { key: "model_shredded", color: "#c5d6db", en: "Shredded", fr: "Sec" },
  { key: "extreme_gaunt", color: "#e9f1f4", en: "Gaunt", fr: "Émacié" },
];

const BODYFAT_ALIASES: Record<string, string> = {
  obese: "obese",
  overweight: "overweight",
  soft: "overweight",
  average_soft: "average_soft",
  average: "average_soft",
  lean: "athletic_lean",
  lean_athletic: "athletic_lean",
  athletic_lean: "athletic_lean",
  model_shredded: "model_shredded",
  extreme_gaunt: "extreme_gaunt",
};

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
  const tierKey =
    BODYFAT_ALIASES[normalizeKey(tierEnum.value) ?? ""] ?? null;
  const tierIdx = BODYFAT_TIERS.findIndex((t) => t.key === tierKey);
  const tierDisplay = tierEnum.value
    ? formatAggregateDisplayValue(
        "bodyfat",
        "body_fat_estimation.visual_estimate_tier",
        tierEnum.value,
        locale,
      )
    : null;

  return (
    <div className="space-y-3">
      <div className={PREVIEW_HERO}>
        {global.score !== null ? <MiniRing score={global.score} /> : null}
        <div className={PREVIEW_COPY}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {i18n(language, { en: "Visual tier", fr: "Niveau visuel" })}
          </p>
          <p className="mt-1 font-display text-base font-bold text-white">
            {tierDisplay ?? "—"}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-400 line-clamp-2">
            {global.argument ??
              i18n(language, {
                en: "Where your face sits on the leanness spectrum.",
                fr: "Position sur le spectre de minceur faciale.",
              })}
          </p>
        </div>
      </div>
      {tierIdx >= 0 ? (
        <div className="space-y-1.5">
          <div className="relative h-7 overflow-hidden rounded-lg border border-white/15">
            <div className="flex h-full">
              {BODYFAT_TIERS.map((t) => (
                <div
                  key={t.key}
                  className="flex-1"
                  style={{ backgroundColor: t.color }}
                />
              ))}
            </div>
            <div
              className="pointer-events-none absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
              style={{
                left: `${((tierIdx + 0.5) / BODYFAT_TIERS.length) * 100}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
            <span>{i18n(language, { en: "Softer", fr: "Plus doux" })}</span>
            <span>{i18n(language, { en: "Leaner", fr: "Plus sec" })}</span>
          </div>
        </div>
      ) : null}
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
        {overall.score !== null ? <MiniRing score={overall.score} /> : null}
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
        {(overall.score ?? definition.score) !== null ? (
          <MiniRing score={(overall.score ?? definition.score) as number} />
        ) : null}
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
        {(overall.score ?? symmetry.score) !== null ? (
          <MiniRing score={(overall.score ?? symmetry.score) as number} />
        ) : null}
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
        {(overall.score ?? whiteness.score) !== null ? (
          <MiniRing score={(overall.score ?? whiteness.score) as number} />
        ) : null}
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
        {(overall.score ?? projection.score) !== null ? (
          <MiniRing score={(overall.score ?? projection.score) as number} />
        ) : null}
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
        {(overall.score ?? density.score) !== null ? (
          <MiniRing score={(overall.score ?? density.score) as number} />
        ) : null}
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
        {overall.score !== null ? <MiniRing score={overall.score} /> : null}
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
        {(overall.score ?? length.score) !== null ? (
          <MiniRing score={(overall.score ?? length.score) as number} />
        ) : null}
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
        {(overall.score ?? fullness.score) !== null ? (
          <MiniRing score={(overall.score ?? fullness.score) as number} />
        ) : null}
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
        {(overall.score ?? contour.score) !== null ? (
          <MiniRing score={(overall.score ?? contour.score) as number} />
        ) : null}
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
        {overall.score !== null ? <MiniRing score={overall.score} /> : null}
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
        {(overall.score ?? sizeHarmony.score) !== null ? (
          <MiniRing
            score={(overall.score ?? sizeHarmony.score) as number}
          />
        ) : null}
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
        {overall.score !== null ? <MiniRing score={overall.score} /> : null}
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
        {hero ? <MiniRing score={hero.score} /> : null}
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
