import * as React from "react";
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
  ScoreBar,
  SectionShell,
  WorkerHero,
} from "./_shared";

const WORKER_KEY = "neck";

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
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
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
