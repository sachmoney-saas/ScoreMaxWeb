import * as React from "react";
import {
  skinRadarAxisHighlights,
  skinRadarAxisPaint,
} from "@/lib/face-analysis-score";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * WorkerSignatureRadar
 *
 * Polar radar (n axes) — utilisé pour montrer la "signature" d'un worker à
 * partir de ses scores leaf. Les axes les plus faibles sont peints en rose
 * pâle, les plus forts en émeraude (cf. `skinRadarAxisHighlights`).
 *
 * Le composant gère lui-même son letterbox (padding pour que les labels ne
 * soient pas clippés) et reste responsive grâce à `viewBox`.
 * ------------------------------------------------------------------------- */

export type WorkerSignatureRadarPoint = {
  label: string;
  score: number;
};

export function WorkerSignatureRadar({
  data,
  ariaLabel,
  className,
  scale = 10,
}: {
  data: readonly WorkerSignatureRadarPoint[];
  ariaLabel: string;
  className?: string;
  /** Score max attendu (10 par défaut sur ScoreMax). */
  scale?: number;
}) {
  const viewPadX = 64;
  const viewPadY = 50;
  const size = 400;
  const center = size / 2;
  const maxRadius = 144;
  const n = data.length;

  if (n < 3) {
    return null;
  }

  const polar = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / n;
    const r = (Math.max(0, Math.min(value, scale)) / scale) * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const labelPolar = (index: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / n;
    const r = maxRadius + 26;
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
  const ringValues = [2.5, 5, 7.5, 10].map((v) => v / 10) as readonly number[];

  return (
    <svg
      viewBox={`-${viewPadX} -${viewPadY} ${size + 2 * viewPadX} ${size + 2 * viewPadY}`}
      className={cn("mx-auto block h-auto w-full max-w-[420px] overflow-visible", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id="workerRadarFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9aaeb5" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d6e4ff" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {ringValues.map((frac) => (
        <circle
          key={`ring-${frac}`}
          cx={center}
          cy={center}
          r={frac * maxRadius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}

      {data.map((_, i) => {
        const end = polar(i, scale);
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
        fill="url(#workerRadarFill)"
        stroke="#cfdde2"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {valuePoints.map((p, i) => {
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        return (
          <circle
            key={`pt-${i}`}
            cx={p.x}
            cy={p.y}
            r={3.4}
            fill={paint.dotFill}
            stroke={paint.dotStroke}
            strokeWidth="1.5"
          />
        );
      })}

      {data.map((d, i) => {
        const lp = labelPolar(i);
        const paint = skinRadarAxisPaint(highlights[i] ?? "neutral");
        return (
          <text
            key={`label-${i}`}
            x={lp.x}
            y={lp.y}
            textAnchor={lp.anchor}
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="600"
            fill={paint.labelFill}
            letterSpacing="0.04em"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------------------------------
 * WorkerStanceMatrix
 *
 * Matrice 10×10 générique (style identique à `BodyfatCompositionMatrixVisual`
 * mais avec libellés d'axes paramétrables). On y projette deux scores 0–10
 * sur deux axes orthogonaux.
 *
 * - Axe X : `xScore` (gauche → droite), 0 = label `xLeft`, 10 = label `xRight`.
 * - Axe Y : `yScore` (bas → haut), 0 = label `yBottom`, 10 = label `yTop`.
 *   La cellule sélectionnée est inversée verticalement (10−y) pour que le
 *   point « haut » soit en haut de la grille.
 * ------------------------------------------------------------------------- */

type AxisLabel = { en: string; fr: string };

export function WorkerStanceMatrix({
  xScore,
  yScore,
  xLeft,
  xRight,
  yBottom,
  yTop,
  language,
  ariaLabel,
}: {
  xScore: number | null;
  yScore: number | null;
  xLeft: AxisLabel;
  xRight: AxisLabel;
  yBottom: AxisLabel;
  yTop: AxisLabel;
  language: AppLanguage;
  ariaLabel: AxisLabel;
}) {
  const cols = 10;
  const rows = 10;

  const xIdx =
    xScore !== null
      ? Math.min(cols - 1, Math.max(0, Math.floor(xScore)))
      : null;
  const yIdx =
    yScore !== null
      ? Math.min(rows - 1, Math.max(0, Math.floor(10 - yScore)))
      : null;

  const labelClass =
    "text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400";

  return (
    <div className="mx-auto w-full max-w-[min(100%,20rem)] sm:max-w-[22rem]">
      <div className="grid grid-cols-[22px_1fr_22px] grid-rows-[22px_1fr_22px] items-center gap-0.5 sm:grid-cols-[26px_1fr_26px] sm:grid-rows-[26px_1fr_26px]">
        <div />
        <div className={`text-center ${labelClass}`}>
          {i18n(language, yTop)}
        </div>
        <div />

        <div className="flex items-center justify-center">
          <span
            className={`inline-block origin-center rotate-[-90deg] whitespace-nowrap text-center ${labelClass}`}
          >
            {i18n(language, xLeft)}
          </span>
        </div>

        <div
          className="relative aspect-square w-full rounded-xl border border-white/10 bg-white/[0.03] p-2"
          role="img"
          aria-label={i18n(language, ariaLabel)}
        >
          <div className="grid h-full w-full grid-cols-10 grid-rows-10 gap-0.5">
            {Array.from({ length: rows }).map((_, ry) =>
              Array.from({ length: cols }).map((_, cx) => {
                const isUser = xIdx === cx && yIdx === ry;
                const distance = Math.hypot(
                  cx - (cols - 1) / 2,
                  ry - (rows - 1) / 2,
                );
                const baseOpacity = Math.max(0.04, 0.18 - distance * 0.019);
                return (
                  <div
                    key={`cell-${ry}-${cx}`}
                    className={`rounded-[3px] sm:rounded-sm transition ${isUser ? "ring-2 ring-white/80" : ""}`}
                    style={{
                      backgroundColor: isUser
                        ? "#e9f1f4"
                        : `rgba(154,174,181,${baseOpacity})`,
                      boxShadow: isUser
                        ? "0 0 14px rgba(255,255,255,0.45)"
                        : undefined,
                    }}
                  />
                );
              }),
            )}
          </div>

          <div className="pointer-events-none absolute inset-y-2 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.35)]" />
          <div className="pointer-events-none absolute inset-x-2 top-1/2 h-[1.5px] -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.35)]" />
        </div>

        <div className="flex items-center justify-center">
          <span
            className={`inline-block origin-center rotate-90 whitespace-nowrap text-center ${labelClass}`}
          >
            {i18n(language, xRight)}
          </span>
        </div>

        <div />
        <div className={`text-center ${labelClass}`}>
          {i18n(language, yBottom)}
        </div>
        <div />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * MorphologyBadge
 *
 * Pastille catégorielle (« droite », « romain », « ronde »…) — remplace les
 * petites silhouettes SVG par un pill métal lisible.
 * ------------------------------------------------------------------------- */

export function MorphologyBadge({
  eyebrow,
  value,
  className,
}: {
  eyebrow: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        {eyebrow}
      </p>
      <p className="mt-1 font-display text-base font-bold text-white">
        {value}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * WorkerSpectrumMeter
 *
 * Spectre horizontal segmenté (n niveaux) avec un (ou deux) curseurs. Style
 * identique à `JawWorkerView.DefinitionMeter` / `BodyfatWorkerView.VisualTierScale`,
 * mais réutilisable.
 * ------------------------------------------------------------------------- */

export type SpectrumSegment = {
  key: string;
  color: string;
  label: AxisLabel;
};

export function WorkerSpectrumMeter({
  segments,
  primary,
  secondary,
  language,
  caption,
  primaryAxisCaption,
}: {
  segments: readonly SpectrumSegment[];
  primary: { score: number | null; label: AxisLabel };
  secondary?: { score: number | null; label: AxisLabel; tone?: "cyan" | "white" };
  language: AppLanguage;
  caption?: { left: AxisLabel; right: AxisLabel };
  /** Caption au-dessus de la barre (ex. « Définition × Contraste cou »). */
  primaryAxisCaption?: AxisLabel;
}) {
  const idxFromScore = (s: number | null) =>
    s === null
      ? null
      : Math.min(
          segments.length - 1,
          Math.max(0, Math.round((s / 10) * (segments.length - 1))),
        );

  const primaryIdx = idxFromScore(primary.score);
  const secondaryIdx = idxFromScore(secondary?.score ?? null);

  const markerPct = (idx: number | null) =>
    idx === null ? null : ((idx + 0.5) / segments.length) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">
          {i18n(language, primary.label)}
        </span>
        {primaryAxisCaption ? (
          <span className="text-xs font-medium text-zinc-400">
            {i18n(language, primaryAxisCaption)}
          </span>
        ) : null}
      </div>

      <div className="relative">
        <div className="relative h-12 w-full overflow-hidden rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex h-full w-full">
            {segments.map((s) => (
              <div
                key={s.key}
                className="h-full flex-1"
                style={{ backgroundColor: s.color }}
              />
            ))}
          </div>
          {segments.slice(1).map((_, i) => (
            <div
              key={`div-${i}`}
              className="absolute inset-y-0 w-px bg-black/20"
              style={{ left: `${((i + 1) / segments.length) * 100}%` }}
            />
          ))}

          {markerPct(primaryIdx) !== null ? (
            <div
              className="pointer-events-none absolute top-1 flex -translate-x-1/2 flex-col items-center gap-0.5"
              style={{ left: `${markerPct(primaryIdx)}%` }}
            >
              <span className="rounded-full bg-zinc-950/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-white ring-1 ring-white/30">
                {i18n(language, primary.label).slice(0, 4)}
              </span>
              <div className="h-7 w-[3px] rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]" />
            </div>
          ) : null}

          {secondary && markerPct(secondaryIdx) !== null ? (
            <div
              className="pointer-events-none absolute bottom-1 flex -translate-x-1/2 flex-col items-center gap-0.5"
              style={{ left: `${markerPct(secondaryIdx)}%` }}
            >
              <div
                className={`h-7 w-[3px] rounded-full shadow-[0_0_0_2px_rgba(0,0,0,0.55)] ${
                  secondary.tone === "cyan" ? "bg-cyan-200" : "bg-white"
                }`}
              />
              <span
                className={`rounded-full bg-zinc-950/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] ring-1 ${
                  secondary.tone === "cyan"
                    ? "text-cyan-200 ring-cyan-200/40"
                    : "text-white ring-white/30"
                }`}
              >
                {i18n(language, secondary.label).slice(0, 4)}
              </span>
            </div>
          ) : null}
        </div>

        <div
          className="mt-2 grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500"
          style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
        >
          {segments.map((s, i) => (
            <span
              key={s.key}
              className={`text-center ${i === primaryIdx ? "text-white" : ""}`}
            >
              {i18n(language, s.label)}
            </span>
          ))}
        </div>

        {caption ? (
          <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            <span>{i18n(language, caption.left)}</span>
            <span>{i18n(language, caption.right)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
