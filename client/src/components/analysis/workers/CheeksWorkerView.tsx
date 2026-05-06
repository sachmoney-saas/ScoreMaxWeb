import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
} from "@/lib/face-analysis-display";
import { calculateWorkerFaceScore } from "@/lib/face-analysis-score";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  bandFromScore,
  getScore,
  hasAnyScore,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "cheeks";

function resolveOverallCheek(aggregates: Record<string, unknown>) {
  const primary = getScore(aggregates, "global_score.overall_cheek_score");
  if (primary.score !== null || primary.argument) {
    return primary;
  }
  return getScore(aggregates, "overall_cheek");
}

/* ----------------------------------------------------------------------------
 * Cheekbone heatmap face
 *
 * Glow follows projection/arch + malar prominence; dashed curve = ogee.
 * ------------------------------------------------------------------------- */

function colorForScore(score: number | null, alpha: number): string {
  if (score === null) return `rgba(154,174,181,${alpha})`;
  const band = bandFromScore(score);
  const rgb =
    band === "excellent"
      ? "110,231,183"
      : band === "good"
        ? "190,242,100"
        : band === "moderate"
          ? "252,211,77"
          : "252,165,165";
  return `rgba(${rgb},${alpha})`;
}

function CheekHeatmap({
  projectionArch,
  malarProminence,
  ogee,
  language,
}: {
  projectionArch: number | null;
  malarProminence: number | null;
  ogee: number | null;
  language: AppLanguage;
}) {
  const cheekSignals = [projectionArch, malarProminence].filter(
    (v): v is number => v !== null,
  );
  const cheekScore =
    cheekSignals.length > 0
      ? cheekSignals.reduce((a, b) => a + b, 0) / cheekSignals.length
      : null;
  const cheekGlow = cheekScore === null ? 0.18 : 0.18 + (cheekScore / 10) * 0.6;

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 200 240"
        className="mx-auto block h-auto w-full max-w-[260px]"
        role="img"
        aria-label="Cheekbone heatmap"
      >
        <defs>
          <radialGradient id="cheekL" cx="0.5" cy="0.5" r="0.55">
            <stop
              offset="0%"
              stopColor={colorForScore(cheekScore, cheekGlow)}
            />
            <stop offset="100%" stopColor="rgba(154,174,181,0)" />
          </radialGradient>
          <radialGradient id="cheekR" cx="0.5" cy="0.5" r="0.55">
            <stop
              offset="0%"
              stopColor={colorForScore(cheekScore, cheekGlow)}
            />
            <stop offset="100%" stopColor="rgba(154,174,181,0)" />
          </radialGradient>
        </defs>

        <path
          d="M100 14 C140 14 160 50 160 110 C160 180 134 230 100 234 C66 230 40 180 40 110 C40 50 60 14 100 14 Z"
          fill="rgba(154,174,181,0.06)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1.4}
        />

        <ellipse cx={56} cy={114} rx={28} ry={16} fill="url(#cheekL)" />
        <ellipse cx={144} cy={114} rx={28} ry={16} fill="url(#cheekR)" />

        {ogee !== null ? (
          <>
            <path
              d="M22 100 Q56 110 56 130 Q56 162 80 200"
              fill="none"
              stroke={colorForScore(ogee, 0.7)}
              strokeWidth={2}
              strokeDasharray="4 5"
            />
            <path
              d="M178 100 Q144 110 144 130 Q144 162 120 200"
              fill="none"
              stroke={colorForScore(ogee, 0.7)}
              strokeWidth={2}
              strokeDasharray="4 5"
            />
          </>
        ) : null}

        <ellipse cx={78} cy={104} rx={6} ry={3} fill="rgba(255,255,255,0.3)" />
        <ellipse cx={122} cy={104} rx={6} ry={3} fill="rgba(255,255,255,0.3)" />

        <path
          d="M84 188 Q100 196 116 188"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-4 rounded-sm"
            style={{ backgroundColor: colorForScore(cheekScore, 0.8) }}
          />
          {i18n(language, { en: "Cheekbone", fr: "Pommette" })}
        </span>
        {ogee !== null ? (
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-4 rounded-sm"
              style={{ backgroundColor: colorForScore(ogee, 0.7) }}
            />
            {i18n(language, { en: "Ogee curve", fr: "Courbe en S" })}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface CheeksWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function CheeksWorkerView({
  aggregates,
  language,
}: CheeksWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );

  const overall = resolveOverallCheek(aggregates);

  const bizygomatic = getScore(
    aggregates,
    "frontal_structure.bizygomatic_width",
  );
  const malarProminence = getScore(
    aggregates,
    "frontal_structure.malar_eminence_prominence",
  );
  const cheekSymmetry = getScore(
    aggregates,
    "frontal_structure.cheek_symmetry",
  );

  const heightPeak = getScore(
    aggregates,
    "profile_structure.cheekbone_height_peak",
  );
  const zygomaticProjectionArch = getScore(
    aggregates,
    "profile_structure.zygomatic_projection_and_arch",
  );
  const ogee = getScore(aggregates, "profile_structure.ogee_curve");

  const midfaceDominance = getScore(aggregates, "harmony.midface_dominance");

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Cheeks", fr: "Joues" })}
        title={i18n(language, {
          en: "Your cheekbone signature",
          fr: "Ta signature des pommettes",
        })}
        argument={overall.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
      />

      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Heatmap", fr: "Carte chaleur" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Bone × arch × ogee",
                  fr: "Os × arc × ogee",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "The cheekbone glow tracks projection and malar prominence. The dashed S-curve reflects ogee balance.",
                  fr: "L'éclat des pommettes suit la projection zygomatique et la prominence des malars. La courbe en pointillés reflète l'équilibre de l'ogee.",
                })}
              </p>
            </div>
            <CheekHeatmap
              projectionArch={zygomaticProjectionArch.score}
              malarProminence={malarProminence.score}
              ogee={ogee.score}
              language={language}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(
            bizygomatic.score,
            malarProminence.score,
            cheekSymmetry.score,
          )}
          eyebrow={i18n(language, {
            en: "Frontal structure",
            fr: "Structure frontale",
          })}
          title={i18n(language, {
            en: "Width, malars & symmetry",
            fr: "Largeur, malars et symétrie",
          })}
        >
          <ScoreBar
            label={formatLabel("frontal_structure.bizygomatic_width")}
            score={bizygomatic.score}
            argument={bizygomatic.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("frontal_structure.malar_eminence_prominence")}
            score={malarProminence.score}
            argument={malarProminence.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("frontal_structure.cheek_symmetry")}
            score={cheekSymmetry.score}
            argument={cheekSymmetry.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(
            heightPeak.score,
            zygomaticProjectionArch.score,
            ogee.score,
          )}
          eyebrow={i18n(language, {
            en: "Profile structure",
            fr: "Structure de profil",
          })}
          title={i18n(language, {
            en: "Height, arch & curve",
            fr: "Hauteur, arc et courbe",
          })}
        >
          <ScoreBar
            label={formatLabel("profile_structure.cheekbone_height_peak")}
            score={heightPeak.score}
            argument={heightPeak.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel(
              "profile_structure.zygomatic_projection_and_arch",
            )}
            score={zygomaticProjectionArch.score}
            argument={zygomaticProjectionArch.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("profile_structure.ogee_curve")}
            score={ogee.score}
            argument={ogee.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(midfaceDominance.score)}
          eyebrow={i18n(language, {
            en: "Harmony",
            fr: "Harmonie",
          })}
          title={i18n(language, {
            en: "Midface dominance",
            fr: "Dominance du midface",
          })}
        >
          <ScoreBar
            label={formatLabel("harmony.midface_dominance")}
            score={midfaceDominance.score}
            argument={midfaceDominance.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
