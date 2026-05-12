import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
} from "@/lib/face-analysis-display";
import { calculateWorkerFaceScore } from "@/lib/face-analysis-score";
import { workerMetricAnchorId, workerSectionAnchorId } from "@/lib/worker-view-anchor";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  getScore,
  hasAnyScore,
  mergeHeroRightSlot,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";
import {
  WorkerSignatureRadar,
  type WorkerSignatureRadarPoint,
} from "./WorkerVisualizations";

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

  const radarLabels: Record<string, { en: string; fr: string }> = {
    "frontal_structure.bizygomatic_width": { en: "Width", fr: "Largeur" },
    "frontal_structure.malar_eminence_prominence": {
      en: "Malar",
      fr: "Malaire",
    },
    "frontal_structure.cheek_symmetry": { en: "Symmetry", fr: "Symétrie" },
    "profile_structure.cheekbone_height_peak": {
      en: "Height",
      fr: "Hauteur",
    },
    "profile_structure.zygomatic_projection_and_arch": {
      en: "Zyg. arch",
      fr: "Arc zygom.",
    },
    "profile_structure.ogee_curve": { en: "Ogee", fr: "Ogee" },
    "harmony.midface_dominance": { en: "Midface", fr: "Midface" },
  };

  const radarSource: { key: string; score: number | null }[] = [
    { key: "frontal_structure.bizygomatic_width", score: bizygomatic.score },
    {
      key: "frontal_structure.malar_eminence_prominence",
      score: malarProminence.score,
    },
    { key: "frontal_structure.cheek_symmetry", score: cheekSymmetry.score },
    { key: "profile_structure.cheekbone_height_peak", score: heightPeak.score },
    {
      key: "profile_structure.zygomatic_projection_and_arch",
      score: zygomaticProjectionArch.score,
    },
    { key: "profile_structure.ogee_curve", score: ogee.score },
    { key: "harmony.midface_dominance", score: midfaceDominance.score },
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

      {radarData.length >= 3 ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 sm:text-[13px] sm:tracking-[0.2em]">
                {i18n(language, {
                  en: "Cheek signature",
                  fr: "Signature des joues",
                })}
              </p>
              <WorkerSignatureRadar
                data={radarData}
                ariaLabel={i18n(language, {
                  en: "Cheek signature radar",
                  fr: "Radar de signature des pommettes",
                })}
                sizePreset="large"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(
            bizygomatic.score,
            malarProminence.score,
            cheekSymmetry.score,
          )}
          sectionId={workerSectionAnchorId(WORKER_KEY, "frontal-structure")}
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
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "frontal_structure.bizygomatic_width",
            )}
          />
          <ScoreBar
            label={formatLabel("frontal_structure.malar_eminence_prominence")}
            score={malarProminence.score}
            argument={malarProminence.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "frontal_structure.malar_eminence_prominence",
            )}
          />
          <ScoreBar
            label={formatLabel("frontal_structure.cheek_symmetry")}
            score={cheekSymmetry.score}
            argument={cheekSymmetry.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "frontal_structure.cheek_symmetry",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(
            heightPeak.score,
            zygomaticProjectionArch.score,
            ogee.score,
          )}
          sectionId={workerSectionAnchorId(WORKER_KEY, "profile-structure")}
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
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "profile_structure.cheekbone_height_peak",
            )}
          />
          <ScoreBar
            label={formatLabel(
              "profile_structure.zygomatic_projection_and_arch",
            )}
            score={zygomaticProjectionArch.score}
            argument={zygomaticProjectionArch.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "profile_structure.zygomatic_projection_and_arch",
            )}
          />
          <ScoreBar
            label={formatLabel("profile_structure.ogee_curve")}
            score={ogee.score}
            argument={ogee.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "profile_structure.ogee_curve",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(midfaceDominance.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "harmony")}
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
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "harmony.midface_dominance",
            )}
          />
        </SectionShell>
      </div>
    </div>
  );
}
