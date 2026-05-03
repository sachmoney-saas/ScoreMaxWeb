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

const WORKER_KEY = "neck";

/* ----------------------------------------------------------------------------
 * Animated neck silhouette — morphs based on length, width, taper, posture.
 * ------------------------------------------------------------------------- */

function NeckSilhouette({
  length,
  width,
  taper,
  posture,
  definition,
  submentalFat,
  language,
}: {
  length: number | null;
  width: number | null;
  taper: number | null;
  posture: number | null;
  definition: number | null;
  submentalFat: number | null;
  language: AppLanguage;
}) {
  const l = length !== null ? Math.max(0, Math.min(10, length)) : 5;
  const w = width !== null ? Math.max(0, Math.min(10, width)) : 5;
  const t = taper !== null ? Math.max(0, Math.min(10, taper)) : 5;
  const p = posture !== null ? Math.max(0, Math.min(10, posture)) : 5;
  const d = definition !== null ? Math.max(0, Math.min(10, definition)) : 5;
  const f = submentalFat !== null ? Math.max(0, Math.min(10, submentalFat)) : 5;

  // Length: 50 → 110 px
  const neckHeight = 50 + (l / 10) * 60;
  // Width at base: 50 → 110 px
  const baseWidth = 50 + (w / 10) * 60;
  // Top width depends on taper (higher = more taper)
  const topWidth = baseWidth - (t / 10) * 18;
  // Posture tilt: higher = straighter, low = forward head
  const postureTilt = ((10 - p) / 10) * 12;

  const cy = 30; // jaw line y
  const baseY = cy + neckHeight;

  // Submental fat mound under chin
  const submentalRadius = 4 + (f / 10) * 10;

  // SCM definition stroke
  const scmAlpha = 0.18 + (d / 10) * 0.5;

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 220 200"
        className="mx-auto block h-auto w-full max-w-[300px]"
        role="img"
        aria-label="Neck silhouette"
      >
        <defs>
          <linearGradient id="neckFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(154,174,181,0.32)" />
            <stop offset="100%" stopColor="rgba(154,174,181,0.16)" />
          </linearGradient>
        </defs>

        {/* Reference vertical */}
        <line
          x1={110}
          y1={6}
          x2={110}
          y2={194}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />

        {/* Jawline (top) */}
        <path
          d={`M${110 - topWidth / 2 - 14} ${cy - 8} Q110 ${cy - 18} ${110 + topWidth / 2 + 14} ${cy - 8}`}
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.4}
          strokeLinecap="round"
        />

        {/* Submental fat */}
        {submentalFat !== null ? (
          <ellipse
            cx={110}
            cy={cy + 4}
            rx={submentalRadius * 1.2}
            ry={submentalRadius * 0.75}
            fill="rgba(0,0,0,0.32)"
          />
        ) : null}

        {/* Neck body (with posture tilt at base) */}
        <path
          d={`M${110 - topWidth / 2} ${cy}
             L${110 - baseWidth / 2 + postureTilt} ${baseY}
             L${110 + baseWidth / 2 + postureTilt} ${baseY}
             L${110 + topWidth / 2} ${cy} Z`}
          fill="url(#neckFill)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />

        {/* SCM (sternocleidomastoid) lines */}
        <line
          x1={110 - topWidth / 2 + 8}
          y1={cy + 6}
          x2={110 - 8 + postureTilt}
          y2={baseY - 4}
          stroke={`rgba(255,255,255,${scmAlpha})`}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <line
          x1={110 + topWidth / 2 - 8}
          y1={cy + 6}
          x2={110 + 8 + postureTilt}
          y2={baseY - 4}
          stroke={`rgba(255,255,255,${scmAlpha})`}
          strokeWidth={1.6}
          strokeLinecap="round"
        />

        {/* Length bracket */}
        <line
          x1={110 + baseWidth / 2 + 22}
          y1={cy}
          x2={110 + baseWidth / 2 + 22}
          y2={baseY}
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={1}
        />
        <line
          x1={110 + baseWidth / 2 + 18}
          y1={cy}
          x2={110 + baseWidth / 2 + 26}
          y2={cy}
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={1}
        />
        <line
          x1={110 + baseWidth / 2 + 18}
          y1={baseY}
          x2={110 + baseWidth / 2 + 26}
          y2={baseY}
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={1}
        />
      </svg>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: { en: "Length", fr: "Longueur" }, score: length },
          { label: { en: "Taper", fr: "Affinement" }, score: taper },
          { label: { en: "Definition", fr: "Définition" }, score: definition },
        ].map((m, i) => {
          const band = m.score === null ? null : bandFromScore(m.score);
          const dot =
            band === "excellent"
              ? "bg-emerald-300"
              : band === "good"
                ? "bg-lime-300"
                : band === "moderate"
                  ? "bg-amber-300"
                  : band === "weak"
                    ? "bg-rose-300"
                    : "bg-zinc-500";
          return (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  {i18n(language, m.label)}
                </span>
              </div>
              <p className="mt-1 font-display text-base font-bold tabular-nums text-white">
                {m.score === null ? "—" : `${m.score.toFixed(0)}/10`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface NeckWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function NeckWorkerView({ aggregates, language }: NeckWorkerViewProps) {
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

  const overall = getScore(aggregates, "overall_neck");

  // Dimensions
  const length = getScore(aggregates, "dimensions_and_proportions.neck_length");
  const width = getScore(aggregates, "dimensions_and_proportions.neck_width");
  const taper = getScore(aggregates, "dimensions_and_proportions.neck_taper");

  // Musculature
  const definition = getScore(
    aggregates,
    "musculature_and_soft_tissue.muscle_definition",
  );
  const submentalFat = getScore(
    aggregates,
    "musculature_and_soft_tissue.submental_fat",
  );
  const adamEnum = getEnum(
    aggregates,
    "musculature_and_soft_tissue.adams_apple_visibility",
  );

  // Skin
  const firmness = getScore(
    aggregates,
    "skin_firmness_and_texture.neck_firmness",
  );
  const texture = getScore(aggregates, "skin_firmness_and_texture.skin_texture");

  // Posture
  const posture = getScore(aggregates, "posture_and_alignment.neck_posture");
  const shapeEnum = getEnum(aggregates, "posture_and_alignment.neck_shape");

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Neck", fr: "Cou" })}
        title={i18n(language, {
          en: "Your neck signature",
          fr: "Ta signature du cou",
        })}
        argument={overall.argument}
        score={overall.score}
        rightSlot={
          shapeEnum.value ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Shape", fr: "Forme" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {formatEnumValue("posture_and_alignment.neck_shape", shapeEnum.value) ??
                  shapeEnum.value}
              </p>
            </div>
          ) : null
        }
      />

      {/* Silhouette */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Profile read", fr: "Lecture de profil" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Length × taper × definition",
                  fr: "Longueur × affinement × définition",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "The silhouette stretches with length, narrows with taper, and reveals SCM definition based on your muscular score. Submental fat appears as a soft shadow under the chin.",
                  fr: "La silhouette s'allonge avec la longueur, s'affine avec le taper, et révèle la définition du SCM selon ton score musculaire. La graisse sous-mentonnière apparaît comme une ombre douce sous le menton.",
                })}
              </p>
            </div>
            <NeckSilhouette
              length={length.score}
              width={width.score}
              taper={taper.score}
              posture={posture.score}
              definition={definition.score}
              submentalFat={submentalFat.score}
              language={language}
            />
          </div>
        </CardContent>
      </Card>

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Dimensions",
            fr: "Dimensions",
          })}
          title={i18n(language, {
            en: "Length, width, taper",
            fr: "Longueur, largeur, affinement",
          })}
        >
          <ScoreBar
            label={formatLabel("dimensions_and_proportions.neck_length")}
            score={length.score}
            argument={length.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("dimensions_and_proportions.neck_width")}
            score={width.score}
            argument={width.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("dimensions_and_proportions.neck_taper")}
            score={taper.score}
            argument={taper.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Musculature",
            fr: "Musculature",
          })}
          title={i18n(language, {
            en: "SCM definition & fat",
            fr: "SCM, définition et gras",
          })}
        >
          <ScoreBar
            label={formatLabel("musculature_and_soft_tissue.muscle_definition")}
            score={definition.score}
            argument={definition.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("musculature_and_soft_tissue.submental_fat")}
            score={submentalFat.score}
            argument={submentalFat.argument}
            language={language}
          />
          {adamEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel(
                    "musculature_and_soft_tissue.adams_apple_visibility",
                  )}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "musculature_and_soft_tissue.adams_apple_visibility",
                    adamEnum.value,
                  )}
                </span>
              </div>
              {adamEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {adamEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Skin firmness",
            fr: "Fermeté de la peau",
          })}
          title={i18n(language, {
            en: "Quality of the surface",
            fr: "Qualité de la surface",
          })}
        >
          <ScoreBar
            label={formatLabel("skin_firmness_and_texture.neck_firmness")}
            score={firmness.score}
            argument={firmness.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("skin_firmness_and_texture.skin_texture")}
            score={texture.score}
            argument={texture.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Posture", fr: "Posture" })}
          title={i18n(language, {
            en: "Alignment",
            fr: "Alignement",
          })}
        >
          <ScoreBar
            label={formatLabel("posture_and_alignment.neck_posture")}
            score={posture.score}
            argument={posture.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
