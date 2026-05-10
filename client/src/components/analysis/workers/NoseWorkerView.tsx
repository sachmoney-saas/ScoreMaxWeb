import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { calculateWorkerFaceScore } from "@/lib/face-analysis-score";
import { workerMetricAnchorId, workerSectionAnchorId } from "@/lib/worker-view-anchor";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO,
  type GuideTraceMetricsForAnalysis,
} from "@shared/schema";
import {
  getEnum,
  getScore,
  hasAnyScore,
  mergeHeroRightSlot,
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
  heroAside?: React.ReactNode;
  captureGuideMetrics?: GuideTraceMetricsForAnalysis | null;
}

export function NoseWorkerView({
  aggregates,
  language,
  heroAside,
  captureGuideMetrics,
}: NoseWorkerViewProps) {
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

  const overall = getScore(aggregates, "global_score.overall_nose_score");

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
  const supratipEnum = getEnum(
    aggregates,
    "profile_dorsum_and_angles.supratip_break",
  );
  const nasofrontal = getScore(
    aggregates,
    "profile_dorsum_and_angles.nasofrontal_angle",
  );
  const nasolabial = getScore(
    aggregates,
    "profile_dorsum_and_angles.nasolabial_angle_rotation",
  );

  // Tip
  const tipDef = getScore(aggregates, "tip_morphology.tip_definition");
  const tipProj = getScore(aggregates, "tip_morphology.tip_projection");

  // Base
  const nostrilEnum = getEnum(aggregates, "base_nostrils_and_surface.nostril_shape");
  const nostrilDisplay = formatEnumValue(
    "base_nostrils_and_surface.nostril_shape",
    nostrilEnum.value,
  );
  const columella = getScore(aggregates, "base_nostrils_and_surface.columella_alignment");
  const noseLength = getScore(aggregates, "base_nostrils_and_surface.nose_length");
  const nasalSkinEnum = getEnum(
    aggregates,
    "base_nostrils_and_surface.nasal_skin_surface",
  );

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
    "tip_morphology.tip_definition": {
      en: "Tip def.",
      fr: "Pointe",
    },
    "tip_morphology.tip_projection": {
      en: "Projection",
      fr: "Projection",
    },
    "base_nostrils_and_surface.columella_alignment": {
      en: "Columella",
      fr: "Columelle",
    },
    "base_nostrils_and_surface.nose_length": { en: "Length", fr: "Longueur" },
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
    { key: "tip_morphology.tip_definition", score: tipDef.score },
    { key: "tip_morphology.tip_projection", score: tipProj.score },
    { key: "base_nostrils_and_surface.columella_alignment", score: columella.score },
    { key: "base_nostrils_and_surface.nose_length", score: noseLength.score },
  ];
  const radarData: WorkerSignatureRadarPoint[] = radarSource.flatMap((d) =>
    d.score === null
      ? []
      : [
          {
            label: i18n(language, radarLabels[d.key]),
            score: d.score,
            anchorId: workerMetricAnchorId(WORKER_KEY, d.key),
          },
        ],
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

  const sectionFrontal = workerSectionAnchorId(WORKER_KEY, "frontal-width");
  const sectionTip = workerSectionAnchorId(WORKER_KEY, "tip-morphology");
  const resolveNoseMatrixCellTarget = (cx: number, ry: number): string => {
    const mid = 4.5;
    if (Math.abs(cx - mid) >= Math.abs(ry - mid)) return sectionFrontal;
    return sectionTip;
  };

  const mouthOverNose = captureGuideMetrics?.[CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO];

  return (
    <div className="space-y-4">
      {mouthOverNose !== undefined && Number.isFinite(mouthOverNose) ? (
        <p className="text-[11px] leading-snug text-zinc-500" role="note">
          <span className="font-semibold uppercase tracking-[0.12em] text-zinc-500">
            {i18n(language, { en: "Capture geometry", fr: "Géométrie capture" })}
          </span>
          <span className="ml-1.5 font-mono text-zinc-400">
            {i18n(language, {
              en: `mouth width / nose width ${mouthOverNose.toLocaleString(language === "fr" ? "fr-FR" : "en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}`,
              fr: `largeur bouche / largeur nez ${mouthOverNose.toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}`,
            })}
          </span>
        </p>
      ) : null}
      <WorkerHero
        eyebrow={i18n(language, { en: "Nose architecture", fr: "Architecture du nez" })}
        title={i18n(language, {
          en: "Your nasal signature",
          fr: "Ta signature nasale",
        })}
        argument={overall.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={mergeHeroRightSlot(
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
          ) : null,
          heroAside,
        )}
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
                {(bridgeEnum.argument ||
                  nostrilEnum.argument ||
                  supratipEnum.argument) && (
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
                    {supratipEnum.argument ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {i18n(language, { en: "Supratip", fr: "Supratip" })}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                          {supratipEnum.argument}
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
                resolveCellTargetId={(cx, ry) => resolveNoseMatrixCellTarget(cx, ry)}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(
            bridgeWidth.score,
            alarWidth.score,
            symmetry.score,
          )}
          sectionId={sectionFrontal}
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
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "frontal_symmetry_and_width.bridge_width",
            )}
          />
          <ScoreBar
            label={formatLabel("frontal_symmetry_and_width.overall_alar_width")}
            score={alarWidth.score}
            argument={alarWidth.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "frontal_symmetry_and_width.overall_alar_width",
            )}
          />
          <ScoreBar
            label={formatLabel("frontal_symmetry_and_width.nose_symmetry")}
            score={symmetry.score}
            argument={symmetry.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "frontal_symmetry_and_width.nose_symmetry",
            )}
          />
        </SectionShell>

        <SectionShell
          when={
            hasAnyScore(nasofrontal.score, nasolabial.score) ||
            Boolean(supratipEnum.value)
          }
          sectionId={workerSectionAnchorId(WORKER_KEY, "profile-angles")}
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
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "profile_dorsum_and_angles.nasofrontal_angle",
            )}
          />
          <ScoreBar
            label={formatLabel("profile_dorsum_and_angles.nasolabial_angle_rotation")}
            score={nasolabial.score}
            argument={nasolabial.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "profile_dorsum_and_angles.nasolabial_angle_rotation",
            )}
          />
          {supratipEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("profile_dorsum_and_angles.supratip_break")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "profile_dorsum_and_angles.supratip_break",
                    supratipEnum.value,
                  )}
                </span>
              </div>
              {supratipEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {supratipEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>

        <SectionShell
          when={hasAnyScore(tipDef.score, tipProj.score)}
          sectionId={sectionTip}
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
            label={formatLabel("tip_morphology.tip_definition")}
            score={tipDef.score}
            argument={tipDef.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "tip_morphology.tip_definition",
            )}
          />
          <ScoreBar
            label={formatLabel("tip_morphology.tip_projection")}
            score={tipProj.score}
            argument={tipProj.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "tip_morphology.tip_projection",
            )}
          />
        </SectionShell>

        <SectionShell
          when={
            hasAnyScore(columella.score, noseLength.score) ||
            Boolean(nasalSkinEnum.value)
          }
          sectionId={workerSectionAnchorId(WORKER_KEY, "base-length")}
          eyebrow={i18n(language, {
            en: "Base & length",
            fr: "Base et longueur",
          })}
          title={i18n(language, {
            en: "Columella, length & skin",
            fr: "Columelle, longueur et peau",
          })}
        >
          <ScoreBar
            label={formatLabel("base_nostrils_and_surface.columella_alignment")}
            score={columella.score}
            argument={columella.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "base_nostrils_and_surface.columella_alignment",
            )}
          />
          <ScoreBar
            label={formatLabel("base_nostrils_and_surface.nose_length")}
            score={noseLength.score}
            argument={noseLength.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "base_nostrils_and_surface.nose_length",
            )}
          />
          {nasalSkinEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("base_nostrils_and_surface.nasal_skin_surface")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "base_nostrils_and_surface.nasal_skin_surface",
                    nasalSkinEnum.value,
                  )}
                </span>
              </div>
              {nasalSkinEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {nasalSkinEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>
      </div>
    </div>
  );
}
