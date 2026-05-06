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

const WORKER_KEY = "eyes";

/* ----------------------------------------------------------------------------
 * Iris color palette (reused from coloring inspiration)
 * ------------------------------------------------------------------------- */

const IRIS_SPECTRUM: { key: string; color: string }[] = [
  { key: "light_blue", color: "#7cb1d6" },
  { key: "dark_blue", color: "#2a5080" },
  { key: "grey_blue", color: "#6b7d8f" },
  { key: "pure_grey", color: "#9da4ad" },
  { key: "light_green", color: "#8fbc8f" },
  { key: "dark_green", color: "#2d5a3a" },
  { key: "hazel_green", color: "#7a8f5c" },
  { key: "hazel_brown", color: "#8b6f47" },
  { key: "light_brown", color: "#a06f43" },
  { key: "medium_brown", color: "#6a4528" },
  { key: "dark_brown", color: "#3a261a" },
  { key: "amber", color: "#b8860b" },
  { key: "almost_black", color: "#1a1410" },
  { key: "central_heterochromia", color: "#6a5acd" },
  { key: "sectoral_heterochromia", color: "#9370db" },
];

function normalizeIrisKey(value: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase().trim().replace(/\s+/g, "_");
}

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
  const normalized = normalizeIrisKey(selected);
  const idx = normalized
    ? IRIS_SPECTRUM.findIndex((p) => p.key === normalized)
    : -1;
  const total = IRIS_SPECTRUM.length;
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
          {IRIS_SPECTRUM.map((p) => (
            <div
              key={p.key}
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

  const overall = getScore(aggregates, "global_score.overall_eye_score");

  const canthalEnum = getEnum(aggregates, "morphology_and_tilt.canthal_tilt");
  const eyeSpacing = getScore(aggregates, "morphology_and_tilt.eye_spacing");
  const orbitalDepth = getScore(aggregates, "morphology_and_tilt.orbital_depth");
  const eyeSym = getScore(aggregates, "morphology_and_tilt.eye_symmetry");

  // Eyelids & sclera
  const upperLid = getScore(aggregates, "eyelids_and_sclera.upper_eyelid_exposure");
  const lowerSclera = getScore(aggregates, "eyelids_and_sclera.lower_scleral_show");
  const epiEnum = getEnum(aggregates, "eyelids_and_sclera.epicanthic_fold");

  const support = getScore(aggregates, "under_eye_health.under_eye_support");
  const pigmentation = getScore(aggregates, "under_eye_health.under_eye_pigmentation");

  const sclera = getScore(aggregates, "iris_sclera_and_lashes.sclera_clarity");
  const limbalEnum = getEnum(
    aggregates,
    "iris_sclera_and_lashes.limbal_ring_visibility",
  );
  const lashes = getScore(aggregates, "iris_sclera_and_lashes.eyelash_density");
  const irisEnum = getEnum(aggregates, "iris_sclera_and_lashes.iris_color");

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
              label={formatLabel("iris_sclera_and_lashes.iris_color")}
              valueLabel={formatEnumValue(
                "iris_sclera_and_lashes.iris_color",
                irisEnum.value,
              )}
              argument={irisEnum.argument}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={
            Boolean(canthalEnum.value) ||
            hasAnyScore(eyeSpacing.score, orbitalDepth.score, eyeSym.score)
          }
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
          when={
            hasAnyScore(upperLid.score, lowerSclera.score) ||
            Boolean(epiEnum.value)
          }
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
        </SectionShell>

        <SectionShell
          when={hasAnyScore(support.score, pigmentation.score)}
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
            label={formatLabel("under_eye_health.under_eye_support")}
            score={support.score}
            argument={support.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("under_eye_health.under_eye_pigmentation")}
            score={pigmentation.score}
            argument={pigmentation.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          when={
            hasAnyScore(sclera.score, lashes.score) || Boolean(limbalEnum.value)
          }
          eyebrow={i18n(language, {
            en: "Iris, sclera & lashes",
            fr: "Iris, sclère et cils",
          })}
          title={i18n(language, {
            en: "Clarity, ring & lashes",
            fr: "Clarté, anneau et cils",
          })}
        >
          <ScoreBar
            label={formatLabel("iris_sclera_and_lashes.sclera_clarity")}
            score={sclera.score}
            argument={sclera.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("iris_sclera_and_lashes.eyelash_density")}
            score={lashes.score}
            argument={lashes.argument}
            language={language}
          />
          {limbalEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("iris_sclera_and_lashes.limbal_ring_visibility")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "iris_sclera_and_lashes.limbal_ring_visibility",
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
