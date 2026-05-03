import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  getEnum,
  getScore,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "smile";

/* ----------------------------------------------------------------------------
 * Whiteness scale — VITA shade-inspired band
 * ------------------------------------------------------------------------- */

const WHITENESS_SHADES = [
  "#cfb99a",
  "#dec8a5",
  "#e6d4b1",
  "#ecdec1",
  "#f1e6ce",
  "#f6eeda",
  "#faf3e6",
  "#fdf8ee",
  "#ffffff",
];

function WhitenessScale({
  score,
  language,
}: {
  score: number | null;
  language: AppLanguage;
}) {
  const idx =
    score === null
      ? null
      : Math.min(
          WHITENESS_SHADES.length - 1,
          Math.max(
            0,
            Math.round((score / 10) * (WHITENESS_SHADES.length - 1)),
          ),
        );
  const pct =
    idx !== null ? ((idx + 0.5) / WHITENESS_SHADES.length) * 100 : null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">
          {i18n(language, { en: "Tooth shade", fr: "Teinte des dents" })}
        </span>
        <span className="font-display text-base font-bold tabular-nums text-white">
          {score === null
            ? "—"
            : `${score.toFixed(score % 1 === 0 ? 0 : 1)}/10`}
        </span>
      </div>
      <div className="relative h-9 w-full overflow-hidden rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex h-full w-full">
          {WHITENESS_SHADES.map((c) => (
            <div
              key={c}
              className="h-full flex-1"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        {pct !== null ? (
          <div
            className="pointer-events-none absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-zinc-950 shadow-[0_0_0_2px_rgba(255,255,255,0.55)]"
            style={{ left: `${pct}%` }}
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        <span>{i18n(language, { en: "Yellowed", fr: "Jaunie" })}</span>
        <span>{i18n(language, { en: "Bright white", fr: "Très blanche" })}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface SmileWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function SmileWorkerView({
  aggregates,
  language,
}: SmileWorkerViewProps) {
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

  const overall = getScore(aggregates, "overall_smile");

  // Dental quality
  const whiteness = getScore(aggregates, "dental_quality.shade_and_whiteness");
  const surface = getScore(aggregates, "dental_quality.surface_integrity");
  const proportions = getScore(aggregates, "dental_quality.tooth_proportions");

  // Smile architecture
  const alignment = getScore(aggregates, "smile_architecture.alignment");
  const midline = getScore(aggregates, "smile_architecture.midline_alignment");
  const smileArc = getScore(aggregates, "smile_architecture.smile_arc");

  // Dynamics
  const symmetry = getScore(aggregates, "smile_dynamics.smile_symmetry");
  const corridors = getScore(aggregates, "smile_dynamics.buccal_corridors");
  const visibility = getScore(aggregates, "smile_dynamics.teeth_visibility_count");
  const gingival = getScore(aggregates, "smile_dynamics.gingival_display");
  const lipCurve = getScore(aggregates, "smile_dynamics.upper_lip_curvature");

  // Facial impact
  const duchenneEnum = getEnum(aggregates, "facial_impact.duchenne_activation");
  const dimples = getScore(aggregates, "facial_impact.cheek_dimples");

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Smile", fr: "Sourire" })}
        title={i18n(language, {
          en: "Your smile signature",
          fr: "Ta signature de sourire",
        })}
        argument={overall.argument}
        score={overall.score}
        rightSlot={
          duchenneEnum.value ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Duchenne", fr: "Duchenne" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {formatEnumValue(
                  "facial_impact.duchenne_activation",
                  duchenneEnum.value,
                ) ?? duchenneEnum.value}
              </p>
            </div>
          ) : null
        }
      />

      {/* Whiteness scale */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="space-y-4 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, { en: "Dental shade", fr: "Teinte dentaire" })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Where your shade falls",
                fr: "Où se situe ta teinte",
              })}
            </h3>
          </div>
          <WhitenessScale score={whiteness.score} language={language} />
          {whiteness.argument ? (
            <p className="text-xs leading-relaxed text-zinc-400">
              {whiteness.argument}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, { en: "Dental quality", fr: "Qualité dentaire" })}
          title={i18n(language, {
            en: "Surface & proportions",
            fr: "Surface et proportions",
          })}
        >
          <ScoreBar
            label={formatLabel("dental_quality.surface_integrity")}
            score={surface.score}
            argument={surface.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("dental_quality.tooth_proportions")}
            score={proportions.score}
            argument={proportions.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Architecture",
            fr: "Architecture",
          })}
          title={i18n(language, {
            en: "Alignment & arc",
            fr: "Alignement et arc",
          })}
        >
          <ScoreBar
            label={formatLabel("smile_architecture.alignment")}
            score={alignment.score}
            argument={alignment.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("smile_architecture.midline_alignment")}
            score={midline.score}
            argument={midline.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("smile_architecture.smile_arc")}
            score={smileArc.score}
            argument={smileArc.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Smile dynamics", fr: "Dynamique du sourire" })}
          title={i18n(language, {
            en: "Symmetry & exposure",
            fr: "Symétrie et exposition",
          })}
        >
          <ScoreBar
            label={formatLabel("smile_dynamics.smile_symmetry")}
            score={symmetry.score}
            argument={symmetry.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("smile_dynamics.buccal_corridors")}
            score={corridors.score}
            argument={corridors.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("smile_dynamics.teeth_visibility_count")}
            score={visibility.score}
            argument={visibility.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("smile_dynamics.gingival_display")}
            score={gingival.score}
            argument={gingival.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("smile_dynamics.upper_lip_curvature")}
            score={lipCurve.score}
            argument={lipCurve.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Facial impact", fr: "Impact facial" })}
          title={i18n(language, {
            en: "Authenticity & dimples",
            fr: "Authenticité et fossettes",
          })}
        >
          {duchenneEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("facial_impact.duchenne_activation")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "facial_impact.duchenne_activation",
                    duchenneEnum.value,
                  )}
                </span>
              </div>
              {duchenneEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {duchenneEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
          <ScoreBar
            label={formatLabel("facial_impact.cheek_dimples")}
            score={dimples.score}
            argument={dimples.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
