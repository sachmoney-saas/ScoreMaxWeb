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

const WORKER_KEY = "nose";

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface NoseWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function NoseWorkerView({ aggregates, language }: NoseWorkerViewProps) {
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

  const overall = getScore(aggregates, "overall_nose");

  // Frontal
  const symmetry = getScore(aggregates, "frontal_symmetry_and_width.nose_symmetry");
  const alarWidth = getScore(
    aggregates,
    "frontal_symmetry_and_width.overall_alar_width",
  );
  const bridgeWidth = getScore(
    aggregates,
    "frontal_symmetry_and_width.bridge_width",
  );

  // Profile
  const bridgeEnum = getEnum(aggregates, "profile_dorsum_and_angles.bridge_shape");
  const bridgeDisplay = formatEnumValue(
    "profile_dorsum_and_angles.bridge_shape",
    bridgeEnum.value,
  );
  const supratip = getScore(aggregates, "profile_dorsum_and_angles.supratip_break");
  const nasofrontal = getScore(
    aggregates,
    "profile_dorsum_and_angles.nasofrontal_angle",
  );
  const nasolabial = getScore(
    aggregates,
    "profile_dorsum_and_angles.nasolabial_angle_rotation",
  );

  // Tip
  const tipDef = getScore(aggregates, "tip_morphology_and_projection.tip_definition");
  const tipProj = getScore(aggregates, "tip_morphology_and_projection.tip_projection");

  // Base
  const nostrilEnum = getEnum(aggregates, "base_and_nostrils.nostril_shape");
  const nostrilDisplay = formatEnumValue(
    "base_and_nostrils.nostril_shape",
    nostrilEnum.value,
  );
  const columella = getScore(aggregates, "base_and_nostrils.columella_alignment");
  const noseLength = getScore(aggregates, "base_and_nostrils.nose_length");

  /** Radar — signature complète du nez (toutes dimensions). */
  const radarLabels: Record<string, { en: string; fr: string }> = {
    "frontal_symmetry_and_width.nose_symmetry": {
      en: "Symmetry",
      fr: "Symétrie",
    },
    "frontal_symmetry_and_width.bridge_width": {
      en: "Bridge",
      fr: "Arête",
    },
    "frontal_symmetry_and_width.overall_alar_width": {
      en: "Alar",
      fr: "Ailes",
    },
    "profile_dorsum_and_angles.nasofrontal_angle": {
      en: "Nasofrontal",
      fr: "Nasofrontal",
    },
    "profile_dorsum_and_angles.nasolabial_angle_rotation": {
      en: "Nasolabial",
      fr: "Nasolabial",
    },
    "profile_dorsum_and_angles.supratip_break": {
      en: "Supratip",
      fr: "Supratip",
    },
    "tip_morphology_and_projection.tip_definition": {
      en: "Tip def.",
      fr: "Pointe",
    },
    "tip_morphology_and_projection.tip_projection": {
      en: "Projection",
      fr: "Projection",
    },
    "base_and_nostrils.columella_alignment": {
      en: "Columella",
      fr: "Columelle",
    },
    "base_and_nostrils.nose_length": { en: "Length", fr: "Longueur" },
  };

  const radarSource: { key: string; score: number | null }[] = [
    { key: "frontal_symmetry_and_width.nose_symmetry", score: symmetry.score },
    { key: "frontal_symmetry_and_width.bridge_width", score: bridgeWidth.score },
    { key: "frontal_symmetry_and_width.overall_alar_width", score: alarWidth.score },
    { key: "profile_dorsum_and_angles.nasofrontal_angle", score: nasofrontal.score },
    {
      key: "profile_dorsum_and_angles.nasolabial_angle_rotation",
      score: nasolabial.score,
    },
    { key: "profile_dorsum_and_angles.supratip_break", score: supratip.score },
    { key: "tip_morphology_and_projection.tip_definition", score: tipDef.score },
    { key: "tip_morphology_and_projection.tip_projection", score: tipProj.score },
    { key: "base_and_nostrils.columella_alignment", score: columella.score },
    { key: "base_and_nostrils.nose_length", score: noseLength.score },
  ];
  const radarData: WorkerSignatureRadarPoint[] = radarSource.flatMap((d) =>
    d.score === null
      ? []
      : [{ label: i18n(language, radarLabels[d.key]), score: d.score }],
  );

  /** Matrice de balance nasale : Largeur (X) × Projection (Y) — un coup d'œil de la dynamique frontale + profil. */
  const widthAxisScore =
    bridgeWidth.score !== null && alarWidth.score !== null
      ? (bridgeWidth.score + alarWidth.score) / 2
      : (bridgeWidth.score ?? alarWidth.score);
  const projectionAxisScore =
    tipProj.score !== null && tipDef.score !== null
      ? (tipProj.score + tipDef.score) / 2
      : (tipProj.score ?? tipDef.score);

  const showStanceMatrix =
    widthAxisScore !== null && projectionAxisScore !== null;

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Nose architecture", fr: "Architecture du nez" })}
        title={i18n(language, {
          en: "Your nasal signature",
          fr: "Ta signature nasale",
        })}
        argument={overall.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={
          bridgeDisplay || nostrilDisplay ? (
            <div className="flex flex-col gap-2">
              {bridgeDisplay ? (
                <MorphologyBadge
                  eyebrow={i18n(language, { en: "Bridge", fr: "Arête" })}
                  value={bridgeDisplay}
                  className="text-right"
                />
              ) : null}
              {nostrilDisplay ? (
                <MorphologyBadge
                  eyebrow={i18n(language, { en: "Nostrils", fr: "Narines" })}
                  value={nostrilDisplay}
                  className="text-right"
                />
              ) : null}
            </div>
          ) : null
        }
      />

      {/* Signature nasale — radar */}
      {radarData.length >= 3 ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr] lg:items-start lg:gap-5">
              <div className="min-w-0 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {i18n(language, {
                    en: "Nasal signature",
                    fr: "Signature nasale",
                  })}
                </p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {i18n(language, {
                    en: "Every dimension at a glance",
                    fr: "Toutes les dimensions d'un coup d'œil",
                  })}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "From bridge geometry to tip definition — the polygon traces how your nose performs across all measured axes.",
                    fr: "De la géométrie de l'arête à la définition de la pointe — le polygone trace la performance de ton nez sur tous les axes mesurés.",
                  })}
                </p>
                {(bridgeEnum.argument || nostrilEnum.argument) && (
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    {bridgeEnum.argument ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {i18n(language, { en: "Bridge", fr: "Arête" })}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                          {bridgeEnum.argument}
                        </p>
                      </div>
                    ) : null}
                    {nostrilEnum.argument ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {i18n(language, { en: "Nostrils", fr: "Narines" })}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                          {nostrilEnum.argument}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <WorkerSignatureRadar
                data={radarData}
                ariaLabel={i18n(language, {
                  en: "Nose signature radar",
                  fr: "Radar de signature nasale",
                })}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Matrice de balance nasale — largeur × projection */}
      {showStanceMatrix ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {i18n(language, {
                    en: "Nasal balance",
                    fr: "Balance nasale",
                  })}
                </p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {i18n(language, {
                    en: "Width × projection",
                    fr: "Largeur × projection",
                  })}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "Where your nose sits between a tight, narrow bridge and a more flared base, and between a soft tip and a strongly projected one.",
                    fr: "La position de ton nez entre une arête fine et serrée et une base plus évasée, et entre une pointe douce et une pointe très projetée.",
                  })}
                </p>
              </div>
              <WorkerStanceMatrix
                xScore={widthAxisScore}
                yScore={projectionAxisScore}
                xLeft={{ en: "Wide", fr: "Large" }}
                xRight={{ en: "Narrow", fr: "Fine" }}
                yBottom={{ en: "Soft", fr: "Douce" }}
                yTop={{ en: "Projected", fr: "Projetée" }}
                language={language}
                ariaLabel={{
                  en: "Nasal balance matrix",
                  fr: "Matrice de balance nasale",
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
            en: "Frontal width",
            fr: "Largeur frontale",
          })}
          title={i18n(language, {
            en: "Bridge & alar width",
            fr: "Arête et ailes",
          })}
        >
          <ScoreBar
            label={formatLabel("frontal_symmetry_and_width.bridge_width")}
            score={bridgeWidth.score}
            argument={bridgeWidth.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("frontal_symmetry_and_width.overall_alar_width")}
            score={alarWidth.score}
            argument={alarWidth.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("frontal_symmetry_and_width.nose_symmetry")}
            score={symmetry.score}
            argument={symmetry.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Profile angles",
            fr: "Angles de profil",
          })}
          title={i18n(language, {
            en: "Nasofrontal & nasolabial",
            fr: "Nasofrontal et nasolabial",
          })}
        >
          <ScoreBar
            label={formatLabel("profile_dorsum_and_angles.nasofrontal_angle")}
            score={nasofrontal.score}
            argument={nasofrontal.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("profile_dorsum_and_angles.nasolabial_angle_rotation")}
            score={nasolabial.score}
            argument={nasolabial.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("profile_dorsum_and_angles.supratip_break")}
            score={supratip.score}
            argument={supratip.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Tip morphology",
            fr: "Morphologie de la pointe",
          })}
          title={i18n(language, {
            en: "Definition & projection",
            fr: "Définition et projection",
          })}
        >
          <ScoreBar
            label={formatLabel("tip_morphology_and_projection.tip_definition")}
            score={tipDef.score}
            argument={tipDef.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("tip_morphology_and_projection.tip_projection")}
            score={tipProj.score}
            argument={tipProj.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Base & length",
            fr: "Base et longueur",
          })}
          title={i18n(language, {
            en: "Columella & length",
            fr: "Columelle et longueur",
          })}
        >
          <ScoreBar
            label={formatLabel("base_and_nostrils.columella_alignment")}
            score={columella.score}
            argument={columella.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("base_and_nostrils.nose_length")}
            score={noseLength.score}
            argument={noseLength.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
