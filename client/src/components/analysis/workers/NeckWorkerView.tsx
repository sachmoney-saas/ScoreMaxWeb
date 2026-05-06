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
import {
  MorphologyBadge,
  WorkerSignatureRadar,
  WorkerStanceMatrix,
  type WorkerSignatureRadarPoint,
} from "./WorkerVisualizations";

const WORKER_KEY = "neck";

function resolveOverallNeck(aggregates: Record<string, unknown>) {
  const primary = getScore(aggregates, "global_score.overall_neck_score");
  if (primary.score !== null || primary.argument) {
    return primary;
  }
  return getScore(aggregates, "overall_neck");
}

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

  const overall = resolveOverallNeck(aggregates);

  const length = getScore(aggregates, "dimensions_and_proportions.neck_length");
  const width = getScore(aggregates, "dimensions_and_proportions.neck_width");
  const shapeTaper = getScore(
    aggregates,
    "dimensions_and_proportions.neck_shape_and_taper",
  );
  const shapeDescriptorEnum = getEnum(
    aggregates,
    "dimensions_and_proportions.neck_shape_and_taper.descriptor",
  );
  const shapeDescriptorDisplay = shapeDescriptorEnum.value
    ? formatEnumValue(
        "dimensions_and_proportions.neck_shape_and_taper.descriptor",
        shapeDescriptorEnum.value,
      )
    : null;

  const scmDefinition = getScore(
    aggregates,
    "musculature_and_soft_tissue.scm_muscle_definition",
  );
  const firmness = getScore(
    aggregates,
    "musculature_and_soft_tissue.neck_firmness",
  );
  const adamEnum = getEnum(
    aggregates,
    "musculature_and_soft_tissue.adams_apple_visibility",
  );

  const posture = getScore(aggregates, "posture_and_alignment.neck_posture");

  const radarLabels: Record<string, { en: string; fr: string }> = {
    "dimensions_and_proportions.neck_length": { en: "Length", fr: "Longueur" },
    "dimensions_and_proportions.neck_width": { en: "Width", fr: "Largeur" },
    "dimensions_and_proportions.neck_shape_and_taper": {
      en: "Shape & taper",
      fr: "Forme & affin.",
    },
    "musculature_and_soft_tissue.scm_muscle_definition": {
      en: "SCM",
      fr: "SCM",
    },
    "musculature_and_soft_tissue.neck_firmness": {
      en: "Firmness",
      fr: "Fermeté",
    },
    "posture_and_alignment.neck_posture": { en: "Posture", fr: "Posture" },
  };

  const radarSource: { key: string; score: number | null }[] = [
    { key: "dimensions_and_proportions.neck_length", score: length.score },
    { key: "dimensions_and_proportions.neck_width", score: width.score },
    {
      key: "dimensions_and_proportions.neck_shape_and_taper",
      score: shapeTaper.score,
    },
    {
      key: "musculature_and_soft_tissue.scm_muscle_definition",
      score: scmDefinition.score,
    },
    {
      key: "musculature_and_soft_tissue.neck_firmness",
      score: firmness.score,
    },
    { key: "posture_and_alignment.neck_posture", score: posture.score },
  ];
  const radarData: WorkerSignatureRadarPoint[] = radarSource.flatMap((d) =>
    d.score === null
      ? []
      : [{ label: i18n(language, radarLabels[d.key]), score: d.score }],
  );

  const showStanceMatrix =
    scmDefinition.score !== null && firmness.score !== null;

  const shapeTaperAside =
    shapeTaper.argument ?? shapeDescriptorEnum.argument ?? null;

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
          shapeDescriptorDisplay ? (
            <MorphologyBadge
              eyebrow={i18n(language, {
                en: "Shape & taper",
                fr: "Forme & affinement",
              })}
              value={shapeDescriptorDisplay ?? shapeDescriptorEnum.value ?? ""}
              className="text-right"
            />
          ) : null
        }
      />

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
                    en: "Proportions, muscle & posture",
                    fr: "Proportions, muscle et posture",
                  })}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "Six signals — length, width, shape, SCM definition, tissue firmness and posture — in one polygon.",
                    fr: "Six signaux — longueur, largeur, forme, définition SCM, fermeté des tissus et posture — dans un polygone.",
                  })}
                </p>
                {shapeTaperAside ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      {i18n(language, {
                        en: "Shape & taper",
                        fr: "Forme et affinement",
                      })}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                      {shapeTaperAside}
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
                    en: "SCM × firmness",
                    fr: "SCM × fermeté",
                  })}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "How visible the SCM is, paired with overall neck tissue firmness.",
                    fr: "Visibilité du SCM, croisée avec la fermeté globale des tissus du cou.",
                  })}
                </p>
              </div>
              <WorkerStanceMatrix
                xScore={scmDefinition.score}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(length.score, width.score, shapeTaper.score)}
          eyebrow={i18n(language, {
            en: "Dimensions",
            fr: "Dimensions",
          })}
          title={i18n(language, {
            en: "Length, width, shape",
            fr: "Longueur, largeur, forme",
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
            label={formatLabel("dimensions_and_proportions.neck_shape_and_taper")}
            score={shapeTaper.score}
            argument={shapeTaper.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          when={
            hasAnyScore(scmDefinition.score, firmness.score) ||
            Boolean(adamEnum.value)
          }
          eyebrow={i18n(language, {
            en: "Musculature & tissue",
            fr: "Musculature et tissus",
          })}
          title={i18n(language, {
            en: "SCM, firmness & larynx",
            fr: "SCM, fermeté et pomme d'Adam",
          })}
        >
          <ScoreBar
            label={formatLabel(
              "musculature_and_soft_tissue.scm_muscle_definition",
            )}
            score={scmDefinition.score}
            argument={scmDefinition.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("musculature_and_soft_tissue.neck_firmness")}
            score={firmness.score}
            argument={firmness.argument}
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
          when={hasAnyScore(posture.score)}
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
