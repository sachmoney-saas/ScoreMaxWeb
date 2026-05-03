import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  GLOBAL_TIER_SEGMENTS,
  localScoreToGlobal100,
} from "@/lib/global-score-tiers";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Shared building blocks for worker visualizations.
 *
 * These keep a consistent ScoreMax design across worker pages while still
 * letting each view ship its own custom charts.
 * ------------------------------------------------------------------------- */

export const workerSectionCardClassName =
  "relative overflow-hidden border-white/15 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.14),transparent_36%),linear-gradient(145deg,rgba(10,16,22,0.85)_0%,rgba(20,31,39,0.81)_48%,rgba(185,204,209,0.2)_100%)] text-zinc-50 shadow-[0_24px_80px_-55px_rgba(0,0,0,0.95)] backdrop-blur-sm";

/**
 * Premium analysis “surface” — Overview worker cards, global score, recommendations
 * tab, protocol hero: radial highlight + dark gradient, border-white/20, blur.
 */
export const analysisSurfaceCardClassName =
  "relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.83)_0%,rgba(20,31,39,0.79)_48%,rgba(185,204,209,0.25)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)] backdrop-blur-sm";

/** Pill « Retour » — même surface sombre (Button `ghost` + `asChild` / Link). */
export const analysisBackNavButtonClassName = cn(
  analysisSurfaceCardClassName,
  "no-default-hover-elevate no-default-active-elevate inline-flex min-h-0 items-center justify-center gap-2 rounded-full border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
);

/* ----------------------------------------------------------------------------
 * Aggregate readers
 * ------------------------------------------------------------------------- */

export function getString(
  aggs: Record<string, unknown>,
  key: string,
): string | null {
  const v = aggs[key];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

export function getNumber(
  aggs: Record<string, unknown>,
  key: string,
): number | null {
  const v = aggs[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  // LLM / pipeline quirks: score sometimes emitted as a single-element array
  if (Array.isArray(v) && v.length > 0) {
    const first = v[0];
    if (typeof first === "number" && Number.isFinite(first)) return first;
    if (typeof first === "string") {
      const parsed = Number(first.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/**
 * Reads a "score + argument" pair, tolerating both
 * `{base}.score` / `{base}.argument` and a flat `{base}` numeric value.
 */
export function getScore(
  aggs: Record<string, unknown>,
  base: string,
): { score: number | null; argument: string | null } {
  const score = getNumber(aggs, `${base}.score`) ?? getNumber(aggs, base);
  const argument = getString(aggs, `${base}.argument`);
  return { score, argument };
}

export function getEnum(
  aggs: Record<string, unknown>,
  ...keys: string[]
): { value: string | null; argument: string | null } {
  for (const key of keys) {
    const value = getString(aggs, key);
    if (value) {
      return {
        value,
        argument: getString(aggs, `${key}.argument`),
      };
    }
  }
  return { value: null, argument: null };
}

/* ----------------------------------------------------------------------------
 * Quality bands (used for badges next to scores)
 * ------------------------------------------------------------------------- */

export type QualityBand = "weak" | "moderate" | "good" | "excellent";

export function bandFromScore(score: number): QualityBand {
  if (score >= 8) return "excellent";
  if (score >= 6) return "good";
  if (score >= 4) return "moderate";
  return "weak";
}

export function bandBadgeClasses(band: QualityBand): string {
  switch (band) {
    case "excellent":
      return "bg-emerald-400/15 text-emerald-200";
    case "good":
      return "bg-lime-400/12 text-lime-200";
    case "moderate":
      return "bg-amber-400/12 text-amber-200";
    case "weak":
    default:
      return "bg-rose-400/12 text-rose-200";
  }
}

export function bandLabel(band: QualityBand, language: AppLanguage): string {
  switch (band) {
    case "excellent":
      return i18n(language, { en: "Excellent", fr: "Excellent" });
    case "good":
      return i18n(language, { en: "Good", fr: "Bon" });
    case "moderate":
      return i18n(language, { en: "Moderate", fr: "Modéré" });
    case "weak":
    default:
      return i18n(language, { en: "Weak", fr: "Faible" });
  }
}

/* ----------------------------------------------------------------------------
 * Section shell (consistent card header)
 * ------------------------------------------------------------------------- */

export function SectionShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={workerSectionCardClassName}>
      <CardContent className="space-y-5 p-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            {eyebrow}
          </p>
          <h3 className="mt-1 font-display text-2xl font-bold tracking-tight text-white">
            {title}
          </h3>
        </div>
        <div className="space-y-5">{children}</div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
 * ScoreBar
 *
 * Unified DA across workers:
 *  - track: subtle white/8
 *  - fill: brand gradient (#9aaeb5 → #e9f1f4)
 *  - quality badge (colored) communicates the band
 * ------------------------------------------------------------------------- */

export function ScoreBar({
  label,
  score,
  argument,
  language,
  scale = 10,
}: {
  label: string;
  score: number | null;
  argument: string | null;
  language: AppLanguage;
  scale?: number;
}) {
  if (score === null) return null;
  const clamped = Math.max(0, Math.min(score, scale));
  const score0to100 = localScoreToGlobal100(clamped, scale);
  const pct = score0to100;
  const band = bandFromScore(clamped);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <div className="flex items-baseline gap-3">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${bandBadgeClasses(
              band,
            )}`}
          >
            {bandLabel(band, language)}
          </span>
          <span className="font-display text-xl font-bold tabular-nums tracking-tight text-white">
            {clamped.toFixed(clamped % 1 === 0 ? 0 : 1)}
            <span className="ml-1 text-xs font-semibold text-zinc-500">
              /{scale}
            </span>
          </span>
        </div>
      </div>

      <div className="relative h-2.5 w-full">
        <div className="absolute inset-0 flex overflow-hidden rounded-full bg-white/[0.06]">
          {GLOBAL_TIER_SEGMENTS.map((seg, i) => (
            <div
              key={i}
              className="h-full border-l border-white/12 bg-white/[0.04] first:border-l-0"
              style={{ width: `${seg.widthFrac * 100}%` }}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <div
            className="h-full bg-gradient-to-r from-[#9aaeb5] via-[#bcd0d6] to-[#e9f1f4]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 z-10 h-7 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.55)]"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      </div>

      {argument ? (
        <p className="text-xs leading-relaxed text-zinc-400">{argument}</p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * ScoreRing — circular gauge for hero/global scores
 * ------------------------------------------------------------------------- */

let ringGradientCounter = 0;
function nextRingGradientId(): string {
  ringGradientCounter += 1;
  return `scoremaxRingGradient_${ringGradientCounter}`;
}

export function ScoreRing({
  score,
  scale = 10,
  className,
  /** When set, fixes decimal places (e.g. 2 for derived skin mean). Otherwise integer vs one decimal. */
  fractionDigits,
}: {
  score: number;
  scale?: number;
  className?: string;
  fractionDigits?: number;
}) {
  const gradientId = React.useMemo(() => nextRingGradientId(), []);
  const clamped = Math.max(0, Math.min(score, scale));
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / scale) * circumference;

  const decimals =
    fractionDigits !== undefined
      ? fractionDigits
      : clamped % 1 === 0
        ? 0
        : 1;

  /** Two-line label centered on the ring (SVG user space). */
  const isGlobalHud = scale >= 100;
  const isTripleDigits = isGlobalHud && clamped >= 100;
  const mainFontSize = isGlobalHud ? (isTripleDigits ? 28 : 32) : 26;
  const subFontSize = isGlobalHud ? 11.5 : 10;
  const mainShiftY = isGlobalHud ? -7 : -4;
  const subShiftY = isGlobalHud ? 15 : 10.5;
  const subLetterSpacing = isGlobalHud ? "0.14em" : "0.12em";

  return (
    <svg
      viewBox="0 0 120 120"
      className={cn("h-32 w-32 shrink-0 sm:h-36 sm:w-36", className)}
      role="img"
      aria-label={`Score ${clamped.toFixed(decimals)} sur ${scale}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="12%" y1="88%" x2="88%" y2="12%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="22%" stopColor="#cbd5e1" />
          <stop offset="48%" stopColor="#ffffff" />
          <stop offset="72%" stopColor="#e8eef5" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="10"
      />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 60 60)"
      />
      <g transform="translate(60,60)" style={{ isolation: "isolate" }}>
        {/* Stack from geometric center — dominantBaseline + tunable offsets for optical balance */}
        <text
          textAnchor="middle"
          dominantBaseline="central"
          className="font-display"
          y={mainShiftY}
          fontSize={mainFontSize}
          fontWeight={700}
          fill="#fefefe"
          letterSpacing={isGlobalHud ? "-0.02em" : "0"}
          style={{
            paintOrder: "stroke fill",
            stroke: "rgba(0,0,0,0.22)",
            strokeWidth: isGlobalHud ? 0.6 : 0.45,
          }}
        >
          {clamped.toFixed(decimals)}
        </text>
        <text
          textAnchor="middle"
          dominantBaseline="central"
          y={subShiftY}
          fontSize={subFontSize}
          fontWeight={600}
          fill="#b8c2cc"
          letterSpacing={subLetterSpacing}
          opacity={0.92}
          style={{
            paintOrder: "stroke fill",
            stroke: "rgba(0,0,0,0.18)",
            strokeWidth: 0.35,
          }}
        >
          / {scale}
        </text>
      </g>
    </svg>
  );
}

/* ----------------------------------------------------------------------------
 * LevelScale — segmented n-levels (e.g. low/medium/high, cool/neutral/warm)
 * ------------------------------------------------------------------------- */

export function LevelScale({
  levels,
  selected,
  label,
  argument,
  language,
}: {
  levels: { value: string; en: string; fr: string }[];
  selected: string | null;
  label: string;
  argument: string | null;
  language: AppLanguage;
}) {
  const selectedIdx = selected
    ? levels.findIndex((l) => l.value === selected.toLowerCase())
    : -1;
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <span className="text-sm font-semibold text-white">
          {selectedIdx >= 0
            ? i18n(language, {
                en: levels[selectedIdx].en,
                fr: levels[selectedIdx].fr,
              })
            : "—"}
        </span>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}
      >
        {levels.map((level, index) => {
          const isActive = index === selectedIdx;
          return (
            <div
              key={level.value}
              className={`flex h-9 items-center justify-center rounded-lg border text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
                isActive
                  ? "border-white/40 bg-white/15 text-white"
                  : "border-white/10 bg-white/5 text-zinc-500"
              }`}
            >
              {i18n(language, { en: level.en, fr: level.fr })}
            </div>
          );
        })}
      </div>
      {argument ? (
        <p className="text-xs leading-relaxed text-zinc-400">{argument}</p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * WorkerHero — consistent hero header with optional ring + argument
 * ------------------------------------------------------------------------- */

export function WorkerHero({
  eyebrow,
  title,
  argument,
  score,
  scale = 10,
  scoreFractionDigits,
  rightSlot,
}: {
  eyebrow: string;
  title: string;
  argument?: string | null;
  score?: number | null;
  scale?: number;
  scoreFractionDigits?: number;
  rightSlot?: React.ReactNode;
}) {
  return (
    <Card className={workerSectionCardClassName}>
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {score !== null && score !== undefined ? (
            <ScoreRing
              score={score}
              scale={scale}
              fractionDigits={scoreFractionDigits}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {eyebrow}
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {title}
            </h2>
            {argument ? (
              <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
                {argument}
              </p>
            ) : null}
          </div>
          {rightSlot ? <div className="ml-auto">{rightSlot}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
