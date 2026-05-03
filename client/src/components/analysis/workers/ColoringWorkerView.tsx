import * as React from "react";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  getEnum,
  getScore,
  LevelScale,
  ScoreBar,
  SectionShell,
  WorkerHero,
} from "./_shared";

const WORKER_KEY = "coloring";

/* ----------------------------------------------------------------------------
 * Color palettes (real swatches for enum visualizations)
 * ------------------------------------------------------------------------- */

type Swatch = { value: string; color: string };

const SKIN_TONE_PALETTE: Swatch[] = [
  { value: "very_fair", color: "#f5e1d6" },
  { value: "fair", color: "#ecc8b0" },
  { value: "medium", color: "#d09a72" },
  { value: "olive", color: "#a87752" },
  { value: "tan", color: "#7c5634" },
  { value: "dark", color: "#4a2e1e" },
];

const HAIR_COLOR_PALETTE: Swatch[] = [
  { value: "black", color: "#0f0d0c" },
  { value: "dark_brown", color: "#3d2419" },
  { value: "medium_brown", color: "#6b4329" },
  { value: "light_brown", color: "#a06d3f" },
  { value: "dark_blonde", color: "#a98454" },
  { value: "blonde", color: "#d8b777" },
  { value: "red", color: "#a53f1d" },
  { value: "grey", color: "#9da0a3" },
  { value: "white", color: "#e8e9ec" },
];

const EYEBROW_COLOR_PALETTE: Swatch[] = [
  { value: "black", color: "#0f0d0c" },
  { value: "dark_brown", color: "#3d2419" },
  { value: "medium_brown", color: "#6b4329" },
  { value: "light_brown", color: "#a06d3f" },
  { value: "blonde", color: "#d8b777" },
  { value: "grey", color: "#9da0a3" },
];

const LIP_COLOR_PALETTE: Swatch[] = [
  { value: "very_pale", color: "#f1d9d2" },
  { value: "pale_pink", color: "#e9b9b3" },
  { value: "pink", color: "#d49a9b" },
  { value: "rose", color: "#c0727b" },
  { value: "red", color: "#9c3d4a" },
  { value: "deep_red", color: "#6e2330" },
  { value: "nude", color: "#c79a86" },
  { value: "dark", color: "#4a2a2a" },
];

const HAIR_WARMTH_LEVELS = [
  { value: "cool", en: "Cool", fr: "Froid" },
  { value: "neutral", en: "Neutral", fr: "Neutre" },
  { value: "warm", en: "Warm", fr: "Chaud" },
];

const CONTRAST_TYPE_LEVELS = [
  { value: "low", en: "Low", fr: "Faible" },
  { value: "medium", en: "Medium", fr: "Moyen" },
  { value: "high", en: "High", fr: "Élevé" },
];

/* ----------------------------------------------------------------------------
 * Local: ColorSwatchScale (specific to coloring — palette of real swatches)
 * ------------------------------------------------------------------------- */

function ColorSwatchScale({
  palette,
  selected,
  label,
  correspondenceLabel,
  valueLabel,
  argument,
}: {
  palette: Swatch[];
  selected: string | null;
  /** Technical / catalog label (e.g. aggregate name) for accessibility. */
  label: string;
  /** What the palette represents — shown above the color strip (hair, skin, …). */
  correspondenceLabel: string;
  valueLabel: string | null;
  argument: string | null;
}) {
  const idx = selected
    ? palette.findIndex((p) => p.value === selected)
    : -1;
  const total = palette.length;
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {correspondenceLabel}
      </p>
      <div
        className="relative h-9 w-full overflow-hidden rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        aria-label={`${correspondenceLabel} — ${label}`}
      >
        <div className="flex h-full w-full">
          {palette.map((p) => (
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

export interface ColoringWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function ColoringWorkerView({
  aggregates,
  language,
}: ColoringWorkerViewProps) {
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

  const globalScore =
    getScore(aggregates, "global_coloring_score").score !== null
      ? getScore(aggregates, "global_coloring_score")
      : getScore(aggregates, "global_coloring");

  const skinTone = getEnum(aggregates, "skin.tone");
  const skinClarity = getScore(aggregates, "skin.clarity");
  const skinEvenness = getScore(aggregates, "skin.evenness");

  const hairColor = getEnum(aggregates, "hair.color");
  const hairDepth = getScore(aggregates, "hair.depth");
  const hairWarmthEnum = getEnum(aggregates, "hair.warmth");
  const hairWarmthScore = getScore(aggregates, "hair.warmth");

  /** Coloring worker output no longer includes iris / limbal detail at this level. */
  const eyeWhitesClarity = getScore(aggregates, "eyes.whites_clarity");

  const browColor = getEnum(aggregates, "eyebrows.color");
  const browDepth = getScore(aggregates, "eyebrows.depth");
  const browContrast = getScore(aggregates, "eyebrows.contrast_vs_skin");

  const lipColor = getEnum(aggregates, "lips.color");
  const lipSaturation = getScore(aggregates, "lips.saturation");

  const contrastHair = getScore(aggregates, "contrast.hair_vs_skin");
  const contrastEyes = getScore(aggregates, "contrast.eyes_vs_skin");
  const contrastBrows = getScore(aggregates, "contrast.brows_vs_skin");
  const contrastLips = getScore(aggregates, "contrast.lips_vs_skin");
  const overallContrastNew = getScore(aggregates, "contrast.overall_contrast_score");
  const contrastOverall =
    overallContrastNew.score !== null
      ? overallContrastNew
      : getScore(aggregates, "contrast.overall_contrast");
  const contrastOverallLabelKey =
    overallContrastNew.score !== null
      ? "contrast.overall_contrast_score"
      : "contrast.overall_contrast";
  const contrastType = getEnum(aggregates, "contrast.contrast_type");

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Coloring overview",
          fr: "Vue d'ensemble colorimétrie",
        })}
        title={i18n(language, {
          en: "Your global coloring",
          fr: "Ta colorimétrie globale",
        })}
        argument={globalScore.argument}
        score={globalScore.score}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, { en: "Hair", fr: "Cheveux" })}
          title={i18n(language, {
            en: "Hair coloring",
            fr: "Couleur des cheveux",
          })}
        >
          <ColorSwatchScale
            palette={HAIR_COLOR_PALETTE}
            selected={hairColor.value}
            correspondenceLabel={i18n(language, {
              en: "Hair",
              fr: "Cheveux",
            })}
            label={formatLabel("hair.color")}
            valueLabel={formatEnumValue("hair.color", hairColor.value)}
            argument={hairColor.argument}
          />
          <ScoreBar
            label={formatLabel("hair.depth")}
            score={hairDepth.score}
            argument={hairDepth.argument}
            language={language}
          />
          {hairWarmthEnum.value ? (
            <LevelScale
              levels={HAIR_WARMTH_LEVELS}
              selected={hairWarmthEnum.value}
              label={formatLabel("hair.warmth")}
              argument={hairWarmthEnum.argument}
              language={language}
            />
          ) : (
            <ScoreBar
              label={formatLabel("hair.warmth")}
              score={hairWarmthScore.score}
              argument={hairWarmthScore.argument}
              language={language}
            />
          )}
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Skin", fr: "Peau" })}
          title={i18n(language, {
            en: "Skin tone & clarity",
            fr: "Teint et clarté",
          })}
        >
          <ColorSwatchScale
            palette={SKIN_TONE_PALETTE}
            selected={skinTone.value}
            correspondenceLabel={i18n(language, {
              en: "Skin",
              fr: "Peau",
            })}
            label={formatLabel("skin.tone")}
            valueLabel={formatEnumValue("skin.tone", skinTone.value)}
            argument={skinTone.argument}
          />
          <ScoreBar
            label={formatLabel("skin.clarity")}
            score={skinClarity.score}
            argument={skinClarity.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("skin.evenness")}
            score={skinEvenness.score}
            argument={skinEvenness.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Eyebrows", fr: "Sourcils" })}
          title={i18n(language, {
            en: "Eyebrow definition",
            fr: "Définition des sourcils",
          })}
        >
          <ColorSwatchScale
            palette={EYEBROW_COLOR_PALETTE}
            selected={browColor.value}
            correspondenceLabel={i18n(language, {
              en: "Eyebrows",
              fr: "Sourcils",
            })}
            label={formatLabel("eyebrows.color")}
            valueLabel={formatEnumValue("eyebrows.color", browColor.value)}
            argument={browColor.argument}
          />
          <ScoreBar
            label={formatLabel("eyebrows.depth")}
            score={browDepth.score}
            argument={browDepth.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("eyebrows.contrast_vs_skin")}
            score={browContrast.score}
            argument={browContrast.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Lips", fr: "Lèvres" })}
          title={i18n(language, {
            en: "Lip coloring",
            fr: "Couleur des lèvres",
          })}
        >
          <ColorSwatchScale
            palette={LIP_COLOR_PALETTE}
            selected={lipColor.value}
            correspondenceLabel={i18n(language, {
              en: "Lips",
              fr: "Lèvres",
            })}
            label={formatLabel("lips.color")}
            valueLabel={formatEnumValue("lips.color", lipColor.value)}
            argument={lipColor.argument}
          />
          <ScoreBar
            label={formatLabel("lips.saturation")}
            score={lipSaturation.score}
            argument={lipSaturation.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Eyes", fr: "Yeux" })}
          title={i18n(language, {
            en: "Sclera (whites)",
            fr: "Blanc des yeux (sclère)",
          })}
        >
          <ScoreBar
            label={formatLabel("eyes.whites_clarity")}
            score={eyeWhitesClarity.score}
            argument={eyeWhitesClarity.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Contrasts", fr: "Contrastes" })}
          title={i18n(language, {
            en: "How features stand out",
            fr: "Lecture des contrastes",
          })}
        >
          <LevelScale
            levels={CONTRAST_TYPE_LEVELS}
            selected={contrastType.value}
            label={formatLabel("contrast.contrast_type")}
            argument={contrastType.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel(contrastOverallLabelKey)}
            score={contrastOverall.score}
            argument={contrastOverall.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("contrast.hair_vs_skin")}
            score={contrastHair.score}
            argument={contrastHair.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("contrast.eyes_vs_skin")}
            score={contrastEyes.score}
            argument={contrastEyes.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("contrast.brows_vs_skin")}
            score={contrastBrows.score}
            argument={contrastBrows.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("contrast.lips_vs_skin")}
            score={contrastLips.score}
            argument={contrastLips.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
