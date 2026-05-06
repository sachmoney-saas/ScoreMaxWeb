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
  type WorkerSignatureRadarPoint,
} from "./WorkerVisualizations";

const WORKER_KEY = "jaw";

function resolveOverallJaw(aggregates: Record<string, unknown>) {
  const primary = getScore(aggregates, "global_score.overall_jaw_score");
  if (primary.score !== null || primary.argument) {
    return primary;
  }
  return getScore(aggregates, "overall_jaw");
}

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

  const overall = resolveOverallJaw(aggregates);

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

  const symmetry = getScore(aggregates, "symmetry_and_flare.jaw_symmetry");
  const gonialFlare = getScore(
    aggregates,
    "symmetry_and_flare.gonial_flare_symmetry",
  );

  const radarLabels: Record<string, { en: string; fr: string }> = {
    "frontal_geometry.jaw_width": { en: "Width", fr: "Largeur" },
    "frontal_geometry.jaw_to_face_proportion": {
      en: "Face proportion",
      fr: "Prop. visage",
    },
    "profile_architecture.jaw_height_ramus": { en: "Ramus", fr: "Ramus" },
    "profile_architecture.jawline_length": { en: "Length", fr: "Longueur" },
    "symmetry_and_flare.jaw_symmetry": { en: "Symmetry", fr: "Symétrie" },
    "symmetry_and_flare.gonial_flare_symmetry": {
      en: "Gonial flare",
      fr: "Flare gonial",
    },
  };

  const radarSource: { key: string; score: number | null }[] = [
    { key: "frontal_geometry.jaw_width", score: jawWidth.score },
    { key: "frontal_geometry.jaw_to_face_proportion", score: jawFace.score },
    { key: "profile_architecture.jaw_height_ramus", score: ramus.score },
    { key: "profile_architecture.jawline_length", score: length.score },
    { key: "symmetry_and_flare.jaw_symmetry", score: symmetry.score },
    {
      key: "symmetry_and_flare.gonial_flare_symmetry",
      score: gonialFlare.score,
    },
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

      {radarData.length >= 3 ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 sm:text-[13px] sm:tracking-[0.2em]">
                {i18n(language, {
                  en: "Jaw signature",
                  fr: "Signature mandibulaire",
                })}
              </p>
              {(frontalEnum.argument || sideEnum.argument) && (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  {frontalEnum.argument ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {i18n(language, { en: "Front view", fr: "Vue frontale" })}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                        {frontalEnum.argument}
                      </p>
                    </div>
                  ) : null}
                  {sideEnum.argument ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {i18n(language, { en: "Side view", fr: "Vue de profil" })}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                        {sideEnum.argument}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
              <WorkerSignatureRadar
                data={radarData}
                ariaLabel={i18n(language, {
                  en: "Jaw signature radar",
                  fr: "Radar de signature mandibulaire",
                })}
                sizePreset="large"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(jawWidth.score, jawFace.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "frontal-geometry")}
          eyebrow={i18n(language, {
            en: "Frontal geometry",
            fr: "Géométrie frontale",
          })}
          title={i18n(language, {
            en: "Width & face proportion",
            fr: "Largeur et proportion visage",
          })}
        >
          <ScoreBar
            label={formatLabel("frontal_geometry.jaw_width")}
            score={jawWidth.score}
            argument={jawWidth.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "frontal_geometry.jaw_width",
            )}
          />
          <ScoreBar
            label={formatLabel("frontal_geometry.jaw_to_face_proportion")}
            score={jawFace.score}
            argument={jawFace.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "frontal_geometry.jaw_to_face_proportion",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(ramus.score, length.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "profile-architecture")}
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
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "profile_architecture.jaw_height_ramus",
            )}
          />
          <ScoreBar
            label={formatLabel("profile_architecture.jawline_length")}
            score={length.score}
            argument={length.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "profile_architecture.jawline_length",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(symmetry.score, gonialFlare.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "symmetry-flare")}
          eyebrow={i18n(language, {
            en: "Symmetry & flare",
            fr: "Symétrie et flare",
          })}
          title={i18n(language, {
            en: "Balance & gonial flare",
            fr: "Équilibre et flare gonial",
          })}
        >
          <ScoreBar
            label={formatLabel("symmetry_and_flare.jaw_symmetry")}
            score={symmetry.score}
            argument={symmetry.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "symmetry_and_flare.jaw_symmetry",
            )}
          />
          <ScoreBar
            label={formatLabel("symmetry_and_flare.gonial_flare_symmetry")}
            score={gonialFlare.score}
            argument={gonialFlare.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "symmetry_and_flare.gonial_flare_symmetry",
            )}
          />
        </SectionShell>
      </div>
    </div>
  );
}
