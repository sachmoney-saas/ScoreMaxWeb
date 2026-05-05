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
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";
import {
  MorphologyBadge,
  WorkerSignatureRadar,
  WorkerStanceMatrix,
  type WorkerSignatureRadarPoint,
} from "./WorkerVisualizations";

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

  const length = getScore(aggregates, "dimensions_and_proportions.neck_length");
  const width = getScore(aggregates, "dimensions_and_proportions.neck_width");
  const taper = getScore(aggregates, "dimensions_and_proportions.neck_taper");

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

  const firmness = getScore(
    aggregates,
    "skin_firmness_and_texture.neck_firmness",
  );
  const texture = getScore(aggregates, "skin_firmness_and_texture.skin_texture");

  const posture = getScore(aggregates, "posture_and_alignment.neck_posture");
  const shapeEnum = getEnum(aggregates, "posture_and_alignment.neck_shape");
  const shapeDisplay = formatEnumValue(
    "posture_and_alignment.neck_shape",
    shapeEnum.value,
  );

  /** Radar signature 8 axes pour le cou. */
  const radarLabels: Record<string, { en: string; fr: string }> = {
    "dimensions_and_proportions.neck_length": { en: "Length", fr: "Longueur" },
    "dimensions_and_proportions.neck_width": { en: "Width", fr: "Largeur" },
    "dimensions_and_proportions.neck_taper": { en: "Taper", fr: "Affinement" },
    "musculature_and_soft_tissue.muscle_definition": {
      en: "Muscle",
      fr: "Muscles",
    },
    "musculature_and_soft_tissue.submental_fat": {
      en: "Submental",
      fr: "Sous-menton",
    },
    "skin_firmness_and_texture.neck_firmness": {
      en: "Firmness",
      fr: "Fermeté",
    },
    "skin_firmness_and_texture.skin_texture": { en: "Texture", fr: "Texture" },
    "posture_and_alignment.neck_posture": { en: "Posture", fr: "Posture" },
  };

  const radarSource: { key: string; score: number | null }[] = [
    { key: "dimensions_and_proportions.neck_length", score: length.score },
    { key: "dimensions_and_proportions.neck_width", score: width.score },
    { key: "dimensions_and_proportions.neck_taper", score: taper.score },
    {
      key: "musculature_and_soft_tissue.muscle_definition",
      score: definition.score,
    },
    {
      key: "musculature_and_soft_tissue.submental_fat",
      score: submentalFat.score,
    },
    { key: "skin_firmness_and_texture.neck_firmness", score: firmness.score },
    { key: "skin_firmness_and_texture.skin_texture", score: texture.score },
    { key: "posture_and_alignment.neck_posture", score: posture.score },
  ];
  const radarData: WorkerSignatureRadarPoint[] = radarSource.flatMap((d) =>
    d.score === null
      ? []
      : [{ label: i18n(language, radarLabels[d.key]), score: d.score }],
  );

  /** Matrice : Définition musculaire (X) × Fermeté tissulaire (Y). */
  const showStanceMatrix =
    definition.score !== null && firmness.score !== null;

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
          shapeDisplay ? (
            <MorphologyBadge
              eyebrow={i18n(language, { en: "Shape", fr: "Forme" })}
              value={shapeDisplay ?? shapeEnum.value ?? ""}
              className="text-right"
            />
          ) : null
        }
      />

      {/* Signature cou — radar */}
      {radarData.length >= 3 ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr] lg:items-start lg:gap-5">
              <div className="min-w-0 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {i18n(language, {
                    en: "Neck signature",
                    fr: "Signature du cou",
                  })}
                </p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {i18n(language, {
                    en: "Architecture, muscle & skin",
                    fr: "Architecture, muscle et peau",
                  })}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "Eight signals — proportions, musculature, skin and posture — fused into a single polygon to read your neck at a glance.",
                    fr: "Huit signaux — proportions, musculature, peau et posture — fusionnés en un polygone pour lire ton cou d'un coup d'œil.",
                  })}
                </p>
                {shapeEnum.argument ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      {i18n(language, { en: "Shape", fr: "Forme" })}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                      {shapeEnum.argument}
                    </p>
                  </div>
                ) : null}
              </div>
              <WorkerSignatureRadar
                data={radarData}
                ariaLabel={i18n(language, {
                  en: "Neck signature radar",
                  fr: "Radar de signature du cou",
                })}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Matrice : Définition musculaire × Fermeté tissulaire */}
      {showStanceMatrix ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {i18n(language, {
                    en: "Muscle × tissue",
                    fr: "Muscle × tissu",
                  })}
                </p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {i18n(language, {
                    en: "Definition × firmness",
                    fr: "Définition × fermeté",
                  })}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "How visible the underlying musculature is, paired with the firmness of the skin and tissue around it.",
                    fr: "À quel point la musculature ressort, croisé avec la fermeté de la peau et des tissus autour.",
                  })}
                </p>
              </div>
              <WorkerStanceMatrix
                xScore={definition.score}
                yScore={firmness.score}
                xLeft={{ en: "Soft", fr: "Doux" }}
                xRight={{ en: "Defined", fr: "Défini" }}
                yBottom={{ en: "Lax", fr: "Relâché" }}
                yTop={{ en: "Firm", fr: "Ferme" }}
                language={language}
                ariaLabel={{
                  en: "Neck composition matrix",
                  fr: "Matrice de composition du cou",
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

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
