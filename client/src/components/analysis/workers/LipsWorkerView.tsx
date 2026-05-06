import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { calculateWorkerFaceScore } from "@/lib/face-analysis-score";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  getEnum,
  getScore,
  hasAnyScore,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "lips";

/* ----------------------------------------------------------------------------
 * Upper / lower ratio bipolar bar
 * ------------------------------------------------------------------------- */

function UpperLowerBar({
  score,
  argument,
  language,
}: {
  score: number | null;
  argument: string | null;
  language: AppLanguage;
}) {
  if (score === null) return null;
  // 0..10 mapped to upper-dominant ↔ lower-dominant
  // We treat 5 as ideal centre, with score representing balance quality.
  const clamped = Math.max(0, Math.min(10, score));
  const pct = (clamped / 10) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">
          {i18n(language, {
            en: "Upper / lower balance",
            fr: "Équilibre supérieure / inférieure",
          })}
        </span>
        <span className="font-display text-base font-bold tabular-nums text-white">
          {clamped.toFixed(clamped % 1 === 0 ? 0 : 1)}
          <span className="ml-0.5 text-xs font-semibold text-zinc-500">/10</span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#9aaeb5] via-[#bcd0d6] to-[#e9f1f4]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        <span>{i18n(language, { en: "Upper dominant", fr: "Sup. dominante" })}</span>
        <span className="text-white/60">
          {i18n(language, { en: "Balanced", fr: "Équilibrée" })}
        </span>
        <span>{i18n(language, { en: "Lower dominant", fr: "Inf. dominante" })}</span>
      </div>
      {argument ? (
        <p className="text-xs leading-relaxed text-zinc-400">{argument}</p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Lip color palette
 * ------------------------------------------------------------------------- */

const LIP_COLOR_PALETTE: { value: string; color: string }[] = [
  { value: "very_pale", color: "#f1d9d2" },
  { value: "pale_pink", color: "#e9b9b3" },
  { value: "pink", color: "#d49a9b" },
  { value: "rose", color: "#c0727b" },
  { value: "red", color: "#9c3d4a" },
  { value: "deep_red", color: "#6e2330" },
  { value: "nude", color: "#c79a86" },
  { value: "dark", color: "#4a2a2a" },
];

function colorForLip(value: string | null): string | undefined {
  if (!value) return undefined;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return LIP_COLOR_PALETTE.find((p) => p.value === k)?.color;
}

function LipColorSwatch({
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
  const k = selected?.toLowerCase().trim().replace(/\s+/g, "_");
  const idx = k ? LIP_COLOR_PALETTE.findIndex((p) => p.value === k) : -1;
  const total = LIP_COLOR_PALETTE.length;
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
          {LIP_COLOR_PALETTE.map((p) => (
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
 * Main view
 * ------------------------------------------------------------------------- */

export interface LipsWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function LipsWorkerView({ aggregates, language }: LipsWorkerViewProps) {
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

  const overallLipScore = getScore(aggregates, "overall_lip_score");
  const overallLipLegacy = getScore(aggregates, "overall_lip");
  const heroArgument =
    overallLipScore.argument ?? overallLipLegacy.argument;

  // Proportions
  const fullness = getScore(aggregates, "proportions_and_width.lip_fullness");
  const upperLower = getScore(aggregates, "proportions_and_width.upper_lower_ratio");
  const width = getScore(aggregates, "proportions_and_width.lip_width");

  // Upper architecture
  const philtrum = getScore(aggregates, "upper_lip_architecture.philtrum_length");
  const cupidsBow = getScore(
    aggregates,
    "upper_lip_architecture.cupids_bow_definition",
  );
  const vermilion = getScore(aggregates, "upper_lip_architecture.vermilion_border");

  // Projection
  const projection = getScore(aggregates, "projection_and_dynamics.lip_projection");
  const commissure = getScore(
    aggregates,
    "projection_and_dynamics.commissure_tilt",
  );

  // Texture & color
  const smoothness = getScore(aggregates, "texture_and_color.smoothness_hydration");
  const youthfulness = getScore(
    aggregates,
    "texture_and_color.perioral_youthfulness",
  );
  const colorContrast = getScore(aggregates, "texture_and_color.color_contrast");

  const colorEnum = getEnum(aggregates, "lip_color_phenotype.exact_lip_color");
  const colorKey = "lip_color_phenotype.exact_lip_color";
  const colorDisplay = colorEnum.value
    ? formatEnumValue(colorKey, colorEnum.value)
    : null;
  const lipFill = colorForLip(colorEnum.value);

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Lips", fr: "Lèvres" })}
        title={i18n(language, {
          en: "Your lip signature",
          fr: "Ta signature labiale",
        })}
        argument={heroArgument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={
          colorDisplay ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <span
                className="h-8 w-8 shrink-0 rounded-full ring-2 ring-white/20"
                style={{ backgroundColor: lipFill ?? "#c0727b" }}
              />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  {i18n(language, { en: "Lip color", fr: "Couleur des lèvres" })}
                </p>
                <p className="mt-0.5 font-display text-base font-bold text-white">
                  {colorDisplay}
                </p>
              </div>
            </div>
          ) : null
        }
      />

      {/* Fullness + upper/lower balance */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, {
                en: "Lip morphology",
                fr: "Morphologie labiale",
              })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Fullness × balance",
                fr: "Volume × équilibre",
              })}
            </h3>
            <div className="space-y-3 pt-2">
              <ScoreBar
                label={formatLabel("proportions_and_width.lip_fullness")}
                score={fullness.score}
                argument={fullness.argument}
                language={language}
              />
              <UpperLowerBar
                score={upperLower.score}
                argument={upperLower.argument}
                language={language}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Color swatch */}
      {colorEnum.value ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Color phenotype", fr: "Phénotype de couleur" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Where your tone falls",
                  fr: "Où se situe ta teinte",
                })}
              </h3>
            </div>
            <LipColorSwatch
              selected={colorEnum.value}
              label={formatLabel(colorKey)}
              valueLabel={colorDisplay}
              argument={colorEnum.argument}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(width.score, philtrum.score)}
          eyebrow={i18n(language, {
            en: "Proportions",
            fr: "Proportions",
          })}
          title={i18n(language, {
            en: "Width & overall scale",
            fr: "Largeur et échelle",
          })}
        >
          <ScoreBar
            label={formatLabel("proportions_and_width.lip_width")}
            score={width.score}
            argument={width.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("upper_lip_architecture.philtrum_length")}
            score={philtrum.score}
            argument={philtrum.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(cupidsBow.score, vermilion.score)}
          eyebrow={i18n(language, {
            en: "Upper architecture",
            fr: "Architecture supérieure",
          })}
          title={i18n(language, {
            en: "Cupid's bow & vermilion",
            fr: "Arc de Cupidon et vermillon",
          })}
        >
          <ScoreBar
            label={formatLabel("upper_lip_architecture.cupids_bow_definition")}
            score={cupidsBow.score}
            argument={cupidsBow.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("upper_lip_architecture.vermilion_border")}
            score={vermilion.score}
            argument={vermilion.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(projection.score, commissure.score)}
          eyebrow={i18n(language, {
            en: "Projection & dynamics",
            fr: "Projection et dynamique",
          })}
          title={i18n(language, {
            en: "Push & corner tilt",
            fr: "Avancée et inclinaison",
          })}
        >
          <ScoreBar
            label={formatLabel("projection_and_dynamics.lip_projection")}
            score={projection.score}
            argument={projection.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("projection_and_dynamics.commissure_tilt")}
            score={commissure.score}
            argument={commissure.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(smoothness.score, youthfulness.score, colorContrast.score)}
          eyebrow={i18n(language, {
            en: "Texture & color",
            fr: "Texture et couleur",
          })}
          title={i18n(language, {
            en: "Surface & contrast",
            fr: "Surface et contraste",
          })}
        >
          <ScoreBar
            label={formatLabel("texture_and_color.smoothness_hydration")}
            score={smoothness.score}
            argument={smoothness.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("texture_and_color.perioral_youthfulness")}
            score={youthfulness.score}
            argument={youthfulness.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("texture_and_color.color_contrast")}
            score={colorContrast.score}
            argument={colorContrast.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
