import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { calculateWorkerFaceScore } from "@/lib/face-analysis-score";
import {
  workerMetricAnchorId,
  workerSectionAnchorId,
} from "@/lib/worker-view-anchor";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  CompositionMatrix,
  getBodyfatCompositionSharpness,
} from "./BodyfatCompositionMatrix";
import {
  getEnum,
  getNumber,
  getScore,
  getString,
  hasAnyScore,
  mergeHeroRightSlot,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "bodyfat";

function resolveFacialLeanness(aggregates: Record<string, unknown>) {
  const primary = getScore(
    aggregates,
    "global_estimation.facial_leanness_score",
  );
  if (primary.score !== null || primary.argument) {
    return primary;
  }
  return getScore(aggregates, "body_fat_estimation.facial_leanness_score");
}

function formatEstimatedBfPercent(aggregates: Record<string, unknown>): {
  display: string | null;
  argument: string | null;
} {
  const n = getNumber(
    aggregates,
    "global_estimation.estimated_body_fat_percentage.value",
  );
  const raw = getString(
    aggregates,
    "global_estimation.estimated_body_fat_percentage.value",
  );
  const argument = getString(
    aggregates,
    "global_estimation.estimated_body_fat_percentage.argument",
  );
  if (n !== null) {
    const s = n % 1 === 0 ? String(n) : n.toFixed(1);
    return { display: `${s}%`, argument };
  }
  if (raw) {
    const trimmed = raw.includes("%") ? raw : `${raw}%`;
    return { display: trimmed, argument };
  }
  return { display: null, argument };
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface BodyfatWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
  heroAside?: React.ReactNode;
}

export function BodyfatWorkerView({
  aggregates,
  language,
  heroAside,
}: BodyfatWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );

  const facialLeanness = resolveFacialLeanness(aggregates);
  const { display: bfPctDisplay, argument: bfPctArgument } =
    formatEstimatedBfPercent(aggregates);
  const waterFlag = getEnum(aggregates, "water_retention_flag.level");
  const waterArgument = getString(aggregates, "water_retention_flag.argument");

  const waterLabel = waterFlag.value
    ? formatAggregateDisplayValue(
        WORKER_KEY,
        "water_retention_flag.level",
        waterFlag.value,
        locale,
      ) ?? waterFlag.value
    : null;

  const jawline = getScore(aggregates, "lower_face_neck.jawline_definition");
  const submental = getScore(
    aggregates,
    "lower_face_neck.submental_fat_tightness",
  );
  const buccal = getScore(aggregates, "midface_buccal.buccal_leanness");
  const zygomatic = getScore(
    aggregates,
    "midface_buccal.zygomatic_bone_visibility",
  );
  const periocular = getScore(
    aggregates,
    "upper_face_skin.periocular_leanness",
  );
  const angularity = getScore(aggregates, "upper_face_skin.facial_angularity");

  const sharpness = getBodyfatCompositionSharpness(aggregates);

  const leafMetricsAnchor = workerSectionAnchorId(WORKER_KEY, "leaf-metrics");

  const showGlobalCard =
    Boolean(bfPctDisplay) ||
    Boolean(bfPctArgument) ||
    Boolean(waterLabel) ||
    Boolean(waterArgument);

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Facial body fat",
          fr: "Masse grasse faciale",
        })}
        title={i18n(language, {
          en: "Your facial leanness",
          fr: "Ta minceur faciale",
        })}
        argument={facialLeanness.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={mergeHeroRightSlot(
          bfPctDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, {
                  en: "Estimated body fat",
                  fr: "Masse grasse estimée",
                })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {bfPctDisplay}
              </p>
            </div>
          ) : waterLabel ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, {
                  en: "Water retention",
                  fr: "Rétention d'eau",
                })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {waterLabel}
              </p>
            </div>
          ) : null,
          heroAside,
        )}
      />

      {showGlobalCard ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {i18n(language, {
                    en: "Global estimation",
                    fr: "Estimation globale",
                  })}
                </p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {i18n(language, {
                    en: "Body fat & hydration context",
                    fr: "Masse grasse et contexte d'hydratation",
                  })}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "Facial leanness informs an approximate body-fat read; water retention can temporarily soften contours.",
                    fr: "La minceur faciale informe une lecture approximative du gras corporel ; la rétention d'eau peut adoucir les contours.",
                  })}
                </p>
              </div>
              <div className="space-y-6">
                {bfPctDisplay || bfPctArgument ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                      {formatLabel(
                        "global_estimation.estimated_body_fat_percentage",
                      )}
                    </p>
                    {bfPctDisplay ? (
                      <p className="font-display text-3xl font-bold text-white">
                        {bfPctDisplay}
                      </p>
                    ) : null}
                    {bfPctArgument ? (
                      <p className="text-xs leading-relaxed text-zinc-400">
                        {bfPctArgument}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {waterLabel || waterArgument ? (
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      {formatLabel("water_retention_flag.level")}
                    </p>
                    {waterLabel ? (
                      <p className="font-display text-lg font-bold text-white">
                        {waterLabel}
                      </p>
                    ) : null}
                    {waterArgument ? (
                      <p className="text-xs leading-relaxed text-zinc-400">
                        {waterArgument}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <CompositionMatrix
            leanness={facialLeanness.score}
            sharpness={sharpness}
            language={language}
            resolveCellTargetId={() => leafMetricsAnchor}
          />
        </CardContent>
      </Card>

      <div
        id={leafMetricsAnchor}
        className="grid gap-4 scroll-mt-28 sm:scroll-mt-32 lg:grid-cols-3"
      >
        <SectionShell
          when={hasAnyScore(jawline.score, submental.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "lower-face")}
          eyebrow={i18n(language, {
            en: "Lower face & neck",
            fr: "Bas du visage et cou",
          })}
          title={i18n(language, {
            en: "Jaw & submental",
            fr: "Mâchoire et menton",
          })}
        >
          <ScoreBar
            label={formatLabel("lower_face_neck.jawline_definition")}
            score={jawline.score}
            argument={jawline.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "lower_face_neck.jawline_definition",
            )}
          />
          <ScoreBar
            label={formatLabel("lower_face_neck.submental_fat_tightness")}
            score={submental.score}
            argument={submental.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "lower_face_neck.submental_fat_tightness",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(buccal.score, zygomatic.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "midface")}
          eyebrow={i18n(language, { en: "Midface", fr: "Milieu du visage" })}
          title={i18n(language, {
            en: "Cheeks & cheekbones",
            fr: "Joues et pommettes",
          })}
        >
          <ScoreBar
            label={formatLabel("midface_buccal.buccal_leanness")}
            score={buccal.score}
            argument={buccal.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "midface_buccal.buccal_leanness",
            )}
          />
          <ScoreBar
            label={formatLabel("midface_buccal.zygomatic_bone_visibility")}
            score={zygomatic.score}
            argument={zygomatic.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "midface_buccal.zygomatic_bone_visibility",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(periocular.score, angularity.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "upper-face")}
          eyebrow={i18n(language, {
            en: "Upper face",
            fr: "Haut du visage",
          })}
          title={i18n(language, {
            en: "Eye area & angularity",
            fr: "Yeux et angulosité",
          })}
        >
          <ScoreBar
            label={formatLabel("upper_face_skin.periocular_leanness")}
            score={periocular.score}
            argument={periocular.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "upper_face_skin.periocular_leanness",
            )}
          />
          <ScoreBar
            label={formatLabel("upper_face_skin.facial_angularity")}
            score={angularity.score}
            argument={angularity.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "upper_face_skin.facial_angularity",
            )}
          />
        </SectionShell>
      </div>
    </div>
  );
}
