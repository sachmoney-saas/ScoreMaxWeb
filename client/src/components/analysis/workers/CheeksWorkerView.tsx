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
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "cheeks";

/* ----------------------------------------------------------------------------
 * Cheekbone heatmap face
 *
 * A stylised face outline with a glowing cheekbone "highlight zone" whose
 * intensity reflects projection + bone definition.
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
  projection,
  definition,
  ogee,
  fullness,
  hollowing,
  language,
}: {
  projection: number | null;
  definition: number | null;
  ogee: number | null;
  fullness: number | null;
  hollowing: number | null;
  language: AppLanguage;
}) {
  // Combined cheekbone glow intensity
  const cheekSignals = [projection, definition].filter(
    (v): v is number => v !== null,
  );
  const cheekScore =
    cheekSignals.length > 0
      ? cheekSignals.reduce((a, b) => a + b, 0) / cheekSignals.length
      : null;
  const cheekGlow = cheekScore === null ? 0.18 : 0.18 + (cheekScore / 10) * 0.6;

  // Hollowing shadow under the cheekbones
  const hollowAlpha =
    hollowing === null ? 0.05 : 0.05 + (hollowing / 10) * 0.32;

  // Mid-cheek volume tint
  const midAlpha = fullness === null ? 0.08 : 0.08 + (fullness / 10) * 0.28;

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
          <radialGradient id="hollowL" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={`rgba(0,0,0,${hollowAlpha})`} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="hollowR" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={`rgba(0,0,0,${hollowAlpha})`} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Face outline */}
        <path
          d="M100 14 C140 14 160 50 160 110 C160 180 134 230 100 234 C66 230 40 180 40 110 C40 50 60 14 100 14 Z"
          fill="rgba(154,174,181,0.06)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1.4}
        />

        {/* Mid-cheek tint */}
        <ellipse cx={66} cy={132} rx={22} ry={16} fill={`rgba(255,255,255,${midAlpha})`} />
        <ellipse cx={134} cy={132} rx={22} ry={16} fill={`rgba(255,255,255,${midAlpha})`} />

        {/* Cheekbone glow */}
        <ellipse cx={56} cy={114} rx={28} ry={16} fill="url(#cheekL)" />
        <ellipse cx={144} cy={114} rx={28} ry={16} fill="url(#cheekR)" />

        {/* Under-cheek hollowing */}
        <ellipse cx={66} cy={150} rx={20} ry={10} fill="url(#hollowL)" />
        <ellipse cx={134} cy={150} rx={20} ry={10} fill="url(#hollowR)" />

        {/* Ogee curve overlay */}
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

        {/* Eye markers */}
        <ellipse cx={78} cy={104} rx={6} ry={3} fill="rgba(255,255,255,0.3)" />
        <ellipse cx={122} cy={104} rx={6} ry={3} fill="rgba(255,255,255,0.3)" />

        {/* Mouth marker */}
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
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-white/30" />
          {i18n(language, { en: "Volume", fr: "Volume" })}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-black/40" />
          {i18n(language, { en: "Hollow", fr: "Creux" })}
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

  const overall = getScore(aggregates, "overall_cheek");

  // Zygomatic placement
  const heightPeak = getScore(
    aggregates,
    "zygomatic_placement.cheekbone_height_peak",
  );
  const bizygomatic = getScore(
    aggregates,
    "zygomatic_placement.bizygomatic_width",
  );
  const cheekToEye = getScore(
    aggregates,
    "zygomatic_placement.cheek_to_eye_support",
  );

  // Projection & contour
  const projection = getScore(
    aggregates,
    "projection_and_contour.zygomatic_projection",
  );
  const definition = getScore(
    aggregates,
    "projection_and_contour.bone_definition",
  );
  const ogee = getScore(aggregates, "projection_and_contour.ogee_curve");

  // Soft tissue
  const fullness = getScore(
    aggregates,
    "soft_tissue_and_hollowing.mid_cheek_fullness",
  );
  const hollowing = getScore(
    aggregates,
    "soft_tissue_and_hollowing.under_cheek_hollowing",
  );

  // Harmony
  const cheekToJaw = getScore(
    aggregates,
    "harmony_and_balance.cheek_to_jaw_balance",
  );
  const cheekSymmetry = getScore(
    aggregates,
    "harmony_and_balance.cheek_symmetry",
  );

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

      {/* Heatmap */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Heatmap", fr: "Carte chaleur" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Bone × volume × shadow",
                  fr: "Os × volume × ombre",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "The cheekbone glow brightens with projection and bone definition. Mid-cheek fullness adds subtle volume, and shadows under the cheekbones reflect the hollowing score. The dashed S-curve traces your ogee.",
                  fr: "L'éclat de la pommette s'intensifie avec la projection et la définition osseuse. Le volume des joues ajoute de la rondeur, et les ombres sous les pommettes reflètent le score de creux. La courbe pointillée trace ton arc en S.",
                })}
              </p>
            </div>
            <CheekHeatmap
              projection={projection.score}
              definition={definition.score}
              ogee={ogee.score}
              fullness={fullness.score}
              hollowing={hollowing.score}
              language={language}
            />
          </div>
        </CardContent>
      </Card>

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Zygomatic placement",
            fr: "Placement zygomatique",
          })}
          title={i18n(language, {
            en: "Position & width",
            fr: "Position et largeur",
          })}
        >
          <ScoreBar
            label={formatLabel("zygomatic_placement.cheekbone_height_peak")}
            score={heightPeak.score}
            argument={heightPeak.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("zygomatic_placement.bizygomatic_width")}
            score={bizygomatic.score}
            argument={bizygomatic.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("zygomatic_placement.cheek_to_eye_support")}
            score={cheekToEye.score}
            argument={cheekToEye.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Projection & contour",
            fr: "Projection et contour",
          })}
          title={i18n(language, {
            en: "Bone & curve",
            fr: "Os et courbe",
          })}
        >
          <ScoreBar
            label={formatLabel("projection_and_contour.zygomatic_projection")}
            score={projection.score}
            argument={projection.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("projection_and_contour.bone_definition")}
            score={definition.score}
            argument={definition.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("projection_and_contour.ogee_curve")}
            score={ogee.score}
            argument={ogee.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Soft tissue",
            fr: "Tissus mous",
          })}
          title={i18n(language, {
            en: "Volume & hollowing",
            fr: "Volume et creux",
          })}
        >
          <ScoreBar
            label={formatLabel("soft_tissue_and_hollowing.mid_cheek_fullness")}
            score={fullness.score}
            argument={fullness.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("soft_tissue_and_hollowing.under_cheek_hollowing")}
            score={hollowing.score}
            argument={hollowing.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Harmony & balance",
            fr: "Harmonie et équilibre",
          })}
          title={i18n(language, {
            en: "Cheek-to-jaw & symmetry",
            fr: "Joue-mâchoire et symétrie",
          })}
        >
          <ScoreBar
            label={formatLabel("harmony_and_balance.cheek_to_jaw_balance")}
            score={cheekToJaw.score}
            argument={cheekToJaw.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("harmony_and_balance.cheek_symmetry")}
            score={cheekSymmetry.score}
            argument={cheekSymmetry.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
