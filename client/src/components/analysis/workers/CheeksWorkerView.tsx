import * as React from "react";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
} from "@/lib/face-analysis-display";
import { calculateWorkerFaceScore } from "@/lib/face-analysis-score";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  getScore,
  hasAnyScore,
  mergeHeroRightSlot,
  ScoreBar,
  SectionShell,
  WorkerHero,
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
 * Main view
 * ------------------------------------------------------------------------- */
export interface CheeksWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
  heroAside?: React.ReactNode;
}

export function CheeksWorkerView({
  aggregates,
  language,
  heroAside,
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
        rightSlot={mergeHeroRightSlot(undefined, heroAside)}
      />

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
