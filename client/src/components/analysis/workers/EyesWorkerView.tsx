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

const WORKER_KEY = "eyes";

/* ----------------------------------------------------------------------------
 * Iris color palette (reused from coloring inspiration)
 * ------------------------------------------------------------------------- */

const IRIS_COLOR_PALETTE: { value: string; color: string }[] = [
  { value: "black", color: "#1a1413" },
  { value: "dark_brown", color: "#3a261a" },
  { value: "medium_brown", color: "#6a4528" },
  { value: "light_brown", color: "#a06f43" },
  { value: "hazel", color: "#9a7a3f" },
  { value: "green", color: "#4f7d4f" },
  { value: "blue_grey", color: "#7488a0" },
  { value: "blue", color: "#3d6a9c" },
  { value: "light_blue", color: "#7cb1d6" },
];

function IrisSwatch({
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
  const idx = selected
    ? IRIS_COLOR_PALETTE.findIndex(
        (p) => p.value === selected.toLowerCase().replace(/\s+/g, "_"),
      )
    : -1;
  const total = IRIS_COLOR_PALETTE.length;
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
          {IRIS_COLOR_PALETTE.map((p) => (
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

export interface EyesWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function EyesWorkerView({ aggregates, language }: EyesWorkerViewProps) {
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

  const overall = getScore(aggregates, "overall_eye_score");

  const canthalEnum = getEnum(aggregates, "morphology_and_tilt.canthal_tilt");
  const eyeSpacing = getScore(aggregates, "morphology_and_tilt.eye_spacing");
  const orbitalDepth = getScore(aggregates, "morphology_and_tilt.orbital_depth");
  const eyeSym = getScore(aggregates, "morphology_and_tilt.eye_symmetry");

  // Eyelids & sclera
  const upperLid = getScore(aggregates, "eyelids_and_sclera.upper_eyelid_exposure");
  const lowerSclera = getScore(aggregates, "eyelids_and_sclera.lower_scleral_show");
  const epiEnum = getEnum(aggregates, "eyelids_and_sclera.epicanthic_fold");

  // Under-eye
  const support = getScore(aggregates, "under_eye_health.support_and_hollows");
  const pigmentation = getScore(aggregates, "under_eye_health.pigmentation");

  // Details & color
  const sclera = getScore(aggregates, "details_and_color.sclera_clarity");
  const limbalEnum = getEnum(aggregates, "details_and_color.limbal_ring_visibility");
  const lashes = getScore(aggregates, "details_and_color.eyelash_density");
  const irisEnum = getEnum(aggregates, "details_and_color.iris_color");

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Eyes",
          fr: "Yeux",
        })}
        title={i18n(language, {
          en: "Your eye signature",
          fr: "Ta signature oculaire",
        })}
        argument={overall.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
      />

      {/* Iris swatch */}
      {irisEnum.value ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Iris color", fr: "Couleur de l'iris" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Where your iris falls",
                  fr: "Où se situe ton iris",
                })}
              </h3>
            </div>
            <IrisSwatch
              selected={irisEnum.value}
              label={formatLabel("details_and_color.iris_color")}
              valueLabel={formatEnumValue("details_and_color.iris_color", irisEnum.value)}
              argument={irisEnum.argument}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Morphology & tilt",
            fr: "Morphologie et inclinaison",
          })}
          title={i18n(language, {
            en: "Spacing, depth & symmetry",
            fr: "Espacement, profondeur et symétrie",
          })}
        >
          {canthalEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("morphology_and_tilt.canthal_tilt")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "morphology_and_tilt.canthal_tilt",
                    canthalEnum.value,
                  )}
                </span>
              </div>
              {canthalEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {canthalEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
          <ScoreBar
            label={formatLabel("morphology_and_tilt.eye_spacing")}
            score={eyeSpacing.score}
            argument={eyeSpacing.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("morphology_and_tilt.orbital_depth")}
            score={orbitalDepth.score}
            argument={orbitalDepth.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("morphology_and_tilt.eye_symmetry")}
            score={eyeSym.score}
            argument={eyeSym.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Eyelids & sclera",
            fr: "Paupières et sclère",
          })}
          title={i18n(language, {
            en: "Lid exposure & whites",
            fr: "Paupières et blanc",
          })}
        >
          <ScoreBar
            label={formatLabel("eyelids_and_sclera.upper_eyelid_exposure")}
            score={upperLid.score}
            argument={upperLid.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("eyelids_and_sclera.lower_scleral_show")}
            score={lowerSclera.score}
            argument={lowerSclera.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Under-eye health",
            fr: "Santé sous les yeux",
          })}
          title={i18n(language, {
            en: "Support & pigmentation",
            fr: "Support et pigmentation",
          })}
        >
          <ScoreBar
            label={formatLabel("under_eye_health.support_and_hollows")}
            score={support.score}
            argument={support.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("under_eye_health.pigmentation")}
            score={pigmentation.score}
            argument={pigmentation.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Color details",
            fr: "Détails couleur",
          })}
          title={i18n(language, {
            en: "Sclera & lashes",
            fr: "Sclère et cils",
          })}
        >
          <ScoreBar
            label={formatLabel("details_and_color.sclera_clarity")}
            score={sclera.score}
            argument={sclera.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("details_and_color.eyelash_density")}
            score={lashes.score}
            argument={lashes.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Architecture",
            fr: "Architecture",
          })}
          title={i18n(language, {
            en: "Folds & rings",
            fr: "Plis et anneaux",
          })}
        >
          {epiEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("eyelids_and_sclera.epicanthic_fold")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "eyelids_and_sclera.epicanthic_fold",
                    epiEnum.value,
                  )}
                </span>
              </div>
              {epiEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {epiEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
          {limbalEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("details_and_color.limbal_ring_visibility")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "details_and_color.limbal_ring_visibility",
                    limbalEnum.value,
                  )}
                </span>
              </div>
              {limbalEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {limbalEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>
      </div>
    </div>
  );
}
