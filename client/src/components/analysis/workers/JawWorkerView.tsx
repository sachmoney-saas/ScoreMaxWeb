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
  WorkerSpectrumMeter,
  type WorkerSignatureRadarPoint,
} from "./WorkerVisualizations";

const WORKER_KEY = "jaw";

/* ----------------------------------------------------------------------------
 * Spectre de définition mandibulaire (gardé tel quel — déjà pro et utile,
 * superposé au radar). On utilise désormais `WorkerSpectrumMeter`.
 * ------------------------------------------------------------------------- */

const JAW_DEFINITION_SEGMENTS = [
  { key: "soft", color: "#3a4a52", label: { en: "Soft", fr: "Doux" } },
  { key: "smooth", color: "#536974", label: { en: "Smooth", fr: "Lisse" } },
  {
    key: "moderate",
    color: "#788d96",
    label: { en: "Moderate", fr: "Modérée" },
  },
  { key: "defined", color: "#9fb4bb", label: { en: "Defined", fr: "Définie" } },
  { key: "sharp", color: "#c5d6db", label: { en: "Sharp", fr: "Marquée" } },
  {
    key: "chiseled",
    color: "#e9f1f4",
    label: { en: "Chiseled", fr: "Ciselée" },
  },
] as const;

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface JawWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function JawWorkerView({ aggregates, language }: JawWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );

  const overall = getScore(aggregates, "overall_jaw");

  const frontalEnum = getEnum(aggregates, "frontal_geometry.jaw_shape_frontal");
  const frontalDisplay = frontalEnum.value
    ? formatAggregateDisplayValue(
        WORKER_KEY,
        "frontal_geometry.jaw_shape_frontal",
        frontalEnum.value,
        locale,
      )
    : null;
  const jawWidth = getScore(aggregates, "frontal_geometry.jaw_width");
  const jawCheek = getScore(aggregates, "frontal_geometry.jaw_to_cheek_ratio");
  const jawFace = getScore(aggregates, "frontal_geometry.jaw_to_face_proportion");

  const sideEnum = getEnum(aggregates, "profile_architecture.jaw_shape_side");
  const sideDisplay = sideEnum.value
    ? formatAggregateDisplayValue(
        WORKER_KEY,
        "profile_architecture.jaw_shape_side",
        sideEnum.value,
        locale,
      )
    : null;
  const ramus = getScore(aggregates, "profile_architecture.jaw_height_ramus");
  const length = getScore(aggregates, "profile_architecture.jawline_length");

  const definition = getScore(
    aggregates,
    "definition_and_contrast.jawline_definition",
  );
  const contrastNeck = getScore(
    aggregates,
    "definition_and_contrast.jawline_contrast_neck",
  );

  const symmetry = getScore(aggregates, "symmetry_and_flare.jaw_symmetry");
  const flare = getScore(aggregates, "symmetry_and_flare.jaw_flare_symmetry");

  /** Données du radar — 8 axes représentatifs de la « signature » de la mâchoire. */
  const radarLabels: Record<string, { en: string; fr: string }> = {
    "frontal_geometry.jaw_width": { en: "Width", fr: "Largeur" },
    "frontal_geometry.jaw_to_cheek_ratio": { en: "Cheek ratio", fr: "Ratio joue" },
    "frontal_geometry.jaw_to_face_proportion": {
      en: "Face ratio",
      fr: "Ratio visage",
    },
    "profile_architecture.jaw_height_ramus": { en: "Ramus", fr: "Ramus" },
    "profile_architecture.jawline_length": { en: "Length", fr: "Longueur" },
    "definition_and_contrast.jawline_definition": {
      en: "Definition",
      fr: "Définition",
    },
    "symmetry_and_flare.jaw_symmetry": { en: "Symmetry", fr: "Symétrie" },
    "symmetry_and_flare.jaw_flare_symmetry": { en: "Flare", fr: "Flare" },
  };

  const radarSource: { key: string; score: number | null }[] = [
    { key: "frontal_geometry.jaw_width", score: jawWidth.score },
    { key: "frontal_geometry.jaw_to_cheek_ratio", score: jawCheek.score },
    { key: "frontal_geometry.jaw_to_face_proportion", score: jawFace.score },
    { key: "profile_architecture.jaw_height_ramus", score: ramus.score },
    { key: "profile_architecture.jawline_length", score: length.score },
    { key: "definition_and_contrast.jawline_definition", score: definition.score },
    { key: "symmetry_and_flare.jaw_symmetry", score: symmetry.score },
    { key: "symmetry_and_flare.jaw_flare_symmetry", score: flare.score },
  ];
  const radarData: WorkerSignatureRadarPoint[] = radarSource.flatMap((d) =>
    d.score === null
      ? []
      : [{ label: i18n(language, radarLabels[d.key]), score: d.score }],
  );

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Jaw architecture",
          fr: "Architecture mandibulaire",
        })}
        title={i18n(language, {
          en: "Your jawline",
          fr: "Ta ligne mandibulaire",
        })}
        argument={overall.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={
          frontalDisplay || sideDisplay ? (
            <div className="flex flex-col gap-2">
              {frontalDisplay ? (
                <MorphologyBadge
                  eyebrow={i18n(language, { en: "Frontal", fr: "Frontale" })}
                  value={frontalDisplay}
                  className="text-right"
                />
              ) : null}
              {sideDisplay ? (
                <MorphologyBadge
                  eyebrow={i18n(language, { en: "Profile", fr: "Profil" })}
                  value={sideDisplay}
                  className="text-right"
                />
              ) : null}
            </div>
          ) : null
        }
      />

      {/* Signature mandibulaire — radar 8 axes */}
      {radarData.length >= 3 ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr] lg:items-start lg:gap-5">
              <div className="min-w-0 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {i18n(language, {
                    en: "Jaw signature",
                    fr: "Signature mandibulaire",
                  })}
                </p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {i18n(language, {
                    en: "Your full mandibular profile",
                    fr: "Ton profil mandibulaire complet",
                  })}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "Eight metrics combined into one polygon — the further a vertex sits from the centre, the stronger that dimension reads on your face.",
                    fr: "Huit métriques combinées en un polygone — plus un sommet s'éloigne du centre, plus cette dimension ressort sur ton visage.",
                  })}
                </p>
                {(frontalEnum.argument || sideEnum.argument) && (
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    {frontalEnum.argument ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {i18n(language, { en: "Front view", fr: "Vue frontale" })}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                          {frontalEnum.argument}
                        </p>
                      </div>
                    ) : null}
                    {sideEnum.argument ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {i18n(language, { en: "Side view", fr: "Vue de profil" })}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                          {sideEnum.argument}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <WorkerSignatureRadar
                data={radarData}
                ariaLabel={i18n(language, {
                  en: "Jaw signature radar",
                  fr: "Radar de signature mandibulaire",
                })}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Spectre de définition × contraste cou */}
      {definition.score !== null || contrastNeck.score !== null ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {i18n(language, {
                    en: "Definition",
                    fr: "Définition",
                  })}
                </p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {i18n(language, {
                    en: "Bone-line clarity",
                    fr: "Lisibilité de la ligne osseuse",
                  })}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "How sharply your mandibular border reads on screen, and how cleanly it separates from the neck.",
                    fr: "À quel point ton bord mandibulaire ressort visuellement, et à quel point il se sépare nettement du cou.",
                  })}
                </p>
              </div>
              <WorkerSpectrumMeter
                segments={JAW_DEFINITION_SEGMENTS}
                primary={{
                  score: definition.score,
                  label: { en: "Definition", fr: "Définition" },
                }}
                secondary={
                  contrastNeck.score !== null
                    ? {
                        score: contrastNeck.score,
                        label: { en: "Neck", fr: "Cou" },
                        tone: "cyan",
                      }
                    : undefined
                }
                primaryAxisCaption={{
                  en: "Definition × Contrast w/ neck",
                  fr: "Définition × Contraste cou",
                }}
                language={language}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Frontal geometry",
            fr: "Géométrie frontale",
          })}
          title={i18n(language, {
            en: "Width & ratios",
            fr: "Largeur et ratios",
          })}
        >
          <ScoreBar
            label={formatLabel("frontal_geometry.jaw_width")}
            score={jawWidth.score}
            argument={jawWidth.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("frontal_geometry.jaw_to_cheek_ratio")}
            score={jawCheek.score}
            argument={jawCheek.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("frontal_geometry.jaw_to_face_proportion")}
            score={jawFace.score}
            argument={jawFace.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Profile architecture",
            fr: "Architecture de profil",
          })}
          title={i18n(language, {
            en: "Ramus & length",
            fr: "Ramus et longueur",
          })}
        >
          <ScoreBar
            label={formatLabel("profile_architecture.jaw_height_ramus")}
            score={ramus.score}
            argument={ramus.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("profile_architecture.jawline_length")}
            score={length.score}
            argument={length.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Definition & contrast",
            fr: "Définition et contraste",
          })}
          title={i18n(language, {
            en: "Edge & shadow",
            fr: "Arête et ombre",
          })}
        >
          <ScoreBar
            label={formatLabel("definition_and_contrast.jawline_definition")}
            score={definition.score}
            argument={definition.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("definition_and_contrast.jawline_contrast_neck")}
            score={contrastNeck.score}
            argument={contrastNeck.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Symmetry",
            fr: "Symétrie",
          })}
          title={i18n(language, {
            en: "Left vs right balance",
            fr: "Équilibre gauche / droite",
          })}
        >
          <ScoreBar
            label={formatLabel("symmetry_and_flare.jaw_symmetry")}
            score={symmetry.score}
            argument={symmetry.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("symmetry_and_flare.jaw_flare_symmetry")}
            score={flare.score}
            argument={flare.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
