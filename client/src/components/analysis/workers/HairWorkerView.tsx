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
  scrollToWorkerAnchor,
} from "@/lib/worker-view-anchor";
import { i18n, type AppLanguage } from "@/lib/i18n";
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
import { WorkerStanceMatrix } from "./WorkerVisualizations";

const WORKER_KEY = "hair";

/* ----------------------------------------------------------------------------
 * Texture gallery — straight / wavy / curly / coily
 * ------------------------------------------------------------------------- */

type TextureKey = "straight" | "wavy" | "curly" | "coily";

const TEXTURES: {
  key: TextureKey;
  label: { en: string; fr: string };
  d: string;
}[] = [
  { key: "straight", label: { en: "Straight", fr: "Lisse" }, d: "M50 6 L50 74" },
  {
    key: "wavy",
    label: { en: "Wavy", fr: "Ondulé" },
    d: "M50 6 Q40 18 50 28 Q60 38 50 50 Q40 62 50 74",
  },
  {
    key: "curly",
    label: { en: "Curly", fr: "Bouclé" },
    d: "M50 8 C30 14 30 28 50 30 C70 32 70 46 50 48 C30 50 30 64 50 70",
  },
  {
    key: "coily",
    label: { en: "Coily", fr: "Crépu" },
    d: "M50 8 C36 12 38 18 50 20 C62 22 60 28 50 30 C38 32 40 38 50 40 C62 42 60 48 50 50 C38 52 40 58 50 60 C62 62 60 68 50 70",
  },
];

const TEXTURE_ALIASES: Record<string, TextureKey> = {
  straight: "straight",
  lisse: "straight",
  type_1: "straight",
  wavy: "wavy",
  ondulé: "wavy",
  ondule: "wavy",
  type_2: "wavy",
  curly: "curly",
  bouclé: "curly",
  boucle: "curly",
  type_3: "curly",
  coily: "coily",
  crépu: "coily",
  crepu: "coily",
  kinky: "coily",
  type_4: "coily",
};

function normalizeTexture(value: string | null): TextureKey | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return TEXTURE_ALIASES[k] ?? null;
}

function TextureGallery({
  selected,
  language,
  taxonomyAnchorId,
}: {
  selected: TextureKey | null;
  language: AppLanguage;
  taxonomyAnchorId: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TEXTURES.map((t) => {
        const isActive = t.key === selected;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => scrollToWorkerAnchor(taxonomyAnchorId)}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-left transition hover:border-white/25 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35 ${
              isActive
                ? "border-white/45 bg-white/[0.08] shadow-[0_0_28px_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <svg viewBox="0 0 100 80" className="h-16 w-12" role="img">
              {/* Three strands for visual richness */}
              {[35, 50, 65].map((cx) => (
                <path
                  key={cx}
                  d={t.d.replace(/50/g, String(cx))}
                  fill="none"
                  stroke={
                    isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.32)"
                  }
                  strokeWidth={isActive ? 1.8 : 1.4}
                  strokeLinecap="round"
                />
              ))}
            </svg>
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
                isActive ? "text-white" : "text-zinc-500"
              }`}
            >
              {i18n(language, t.label)}
            </span>
            {isActive ? (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface HairWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
  heroAside?: React.ReactNode;
}

export function HairWorkerView({
  aggregates,
  language,
  heroAside,
}: HairWorkerViewProps) {
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

  const overall = getScore(aggregates, "global_score.overall_hair_score");

  const density = getScore(aggregates, "hair_quality_and_health.density");
  const shineDry = getScore(
    aggregates,
    "hair_quality_and_health.shine_and_dryness",
  );
  const health = getScore(
    aggregates,
    "hair_quality_and_health.health_appearance",
  );
  const uniformity = getScore(
    aggregates,
    "hair_quality_and_health.uniformity",
  );

  const groomingQuality = getScore(
    aggregates,
    "grooming_and_haircut.grooming_quality",
  );
  const haircutControl = getScore(
    aggregates,
    "grooming_and_haircut.haircut_control",
  );

  // Characteristics
  const textureEnum = getEnum(aggregates, "hair_characteristics.texture_type");
  const textureKey = normalizeTexture(textureEnum.value);
  const textureDisplay = formatEnumValue(
    "hair_characteristics.texture_type",
    textureEnum.value,
  );
  const curlDef = getScore(aggregates, "hair_characteristics.curl_definition");
  const lengthEnum = getEnum(aggregates, "hair_characteristics.length_category");

  // Hairline
  const hairlineShape = getEnum(aggregates, "hairline.shape");
  const hairlineSym = getScore(aggregates, "hairline.symmetry");
  const hairlineDensity = getScore(aggregates, "hairline.density");
  const recession = getScore(aggregates, "hairline.recession_level");

  const textureTaxonomyAnchor = workerSectionAnchorId(WORKER_KEY, "texture-taxonomy");

  const resolveHairGroomingCutMatrixCellTarget = React.useCallback(
    (cx: number, ry: number): string => {
      const groomingSynth = cx + 0.5;
      const haircutSynth = 9.5 - ry;
      return groomingSynth <= haircutSynth
        ? workerMetricAnchorId(
            WORKER_KEY,
            "grooming_and_haircut.grooming_quality",
          )
        : workerMetricAnchorId(
            WORKER_KEY,
            "grooming_and_haircut.haircut_control",
          );
    },
    [],
  );

  const showGroomingCutMatrix = hasAnyScore(
    groomingQuality.score,
    haircutControl.score,
  );

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Hair", fr: "Cheveux" })}
        title={i18n(language, {
          en: "Your hair signature",
          fr: "Ta signature capillaire",
        })}
        argument={overall.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={mergeHeroRightSlot(
          textureDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Texture", fr: "Texture" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {textureDisplay}
              </p>
            </div>
          ) : null,
          heroAside,
        )}
      />

      {showGroomingCutMatrix ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {i18n(language, {
                    en: "Grooming & haircut",
                    fr: "Toilettage et coupe",
                  })}
                </p>
                <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {i18n(language, {
                    en: "Finish × control",
                    fr: "Finition × contrôle",
                  })}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {i18n(language, {
                    en: "Day-to-day polish on the horizontal axis and how intentional your cut shape reads on the vertical. Tap any cell to scroll to the matching score block.",
                    fr: "Le soin au quotidien sur l’axe horizontal et la maîtrise de la forme de coupe sur l’axe vertical. Touchez une case pour afficher le score correspondant.",
                  })}
                </p>
              </div>
              <WorkerStanceMatrix
                xScore={groomingQuality.score}
                yScore={haircutControl.score}
                xLeft={{
                  en: "Rough upkeep",
                  fr: "Toilettage négligé",
                }}
                xRight={{
                  en: "Polished upkeep",
                  fr: "Toilettage soigné",
                }}
                yBottom={{
                  en: "Loose cut",
                  fr: "Coupe peu maîtrisée",
                }}
                yTop={{
                  en: "Sharp cut",
                  fr: "Coupe maîtrisée",
                }}
                language={language}
                ariaLabel={{
                  en: "Grooming and haircut stance matrix",
                  fr: "Matrice toilettage et coupe",
                }}
                resolveCellTargetId={resolveHairGroomingCutMatrixCellTarget}
                quadrantPalette="performance"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card
        id={textureTaxonomyAnchor}
        className={`${workerSectionCardClassName} scroll-mt-28 sm:scroll-mt-32`}
      >
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, { en: "Texture taxonomy", fr: "Taxonomie de texture" })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Where your hair sits",
                fr: "Où se situe ta texture",
              })}
            </h3>
            {textureEnum.argument ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                {textureEnum.argument}
              </p>
            ) : null}
          </div>
          <TextureGallery
            selected={textureKey}
            language={language}
            taxonomyAnchorId={textureTaxonomyAnchor}
          />
        </CardContent>
      </Card>

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={hasAnyScore(
            density.score,
            shineDry.score,
            health.score,
            uniformity.score,
          )}
          sectionId={workerSectionAnchorId(WORKER_KEY, "hair-quality")}
          eyebrow={i18n(language, {
            en: "Hair quality & health",
            fr: "Qualité et santé",
          })}
          title={i18n(language, {
            en: "Density, shine & uniformity",
            fr: "Densité, brillance et uniformité",
          })}
        >
          <ScoreBar
            label={formatLabel("hair_quality_and_health.density")}
            score={density.score}
            argument={density.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "hair_quality_and_health.density",
            )}
          />
          <ScoreBar
            label={formatLabel("hair_quality_and_health.shine_and_dryness")}
            score={shineDry.score}
            argument={shineDry.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "hair_quality_and_health.shine_and_dryness",
            )}
          />
          <ScoreBar
            label={formatLabel("hair_quality_and_health.health_appearance")}
            score={health.score}
            argument={health.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "hair_quality_and_health.health_appearance",
            )}
          />
          <ScoreBar
            label={formatLabel("hair_quality_and_health.uniformity")}
            score={uniformity.score}
            argument={uniformity.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "hair_quality_and_health.uniformity",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(groomingQuality.score, haircutControl.score)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "grooming")}
          eyebrow={i18n(language, {
            en: "Grooming & haircut",
            fr: "Toilettage et coupe",
          })}
          title={i18n(language, {
            en: "Finish and control",
            fr: "Finition et contrôle",
          })}
        >
          <ScoreBar
            label={formatLabel("grooming_and_haircut.grooming_quality")}
            score={groomingQuality.score}
            argument={groomingQuality.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "grooming_and_haircut.grooming_quality",
            )}
          />
          <ScoreBar
            label={formatLabel("grooming_and_haircut.haircut_control")}
            score={haircutControl.score}
            argument={haircutControl.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "grooming_and_haircut.haircut_control",
            )}
          />
        </SectionShell>

        <SectionShell
          when={hasAnyScore(curlDef.score) || Boolean(lengthEnum.value)}
          sectionId={workerSectionAnchorId(WORKER_KEY, "characteristics")}
          eyebrow={i18n(language, {
            en: "Characteristics",
            fr: "Caractéristiques",
          })}
          title={i18n(language, {
            en: "Curl & length",
            fr: "Boucles et longueur",
          })}
        >
          <ScoreBar
            label={formatLabel("hair_characteristics.curl_definition")}
            score={curlDef.score}
            argument={curlDef.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "hair_characteristics.curl_definition",
            )}
          />
          {lengthEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("hair_characteristics.length_category")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "hair_characteristics.length_category",
                    lengthEnum.value,
                  )}
                </span>
              </div>
              {lengthEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {lengthEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>

        <SectionShell
          when={
            hasAnyScore(
              hairlineSym.score,
              hairlineDensity.score,
              recession.score,
            ) || Boolean(hairlineShape.value)
          }
          sectionId={workerSectionAnchorId(WORKER_KEY, "hairline")}
          eyebrow={i18n(language, { en: "Hairline detail", fr: "Détail de la ligne" })}
          title={i18n(language, {
            en: "Shape, symmetry & recession",
            fr: "Forme, symétrie et recul",
          })}
        >
          {hairlineShape.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("hairline.shape")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue("hairline.shape", hairlineShape.value)}
                </span>
              </div>
              {hairlineShape.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {hairlineShape.argument}
                </p>
              ) : null}
            </div>
          ) : null}
          <ScoreBar
            label={formatLabel("hairline.symmetry")}
            score={hairlineSym.score}
            argument={hairlineSym.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(WORKER_KEY, "hairline.symmetry")}
          />
          <ScoreBar
            label={formatLabel("hairline.density")}
            score={hairlineDensity.score}
            argument={hairlineDensity.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(WORKER_KEY, "hairline.density")}
          />
          <ScoreBar
            label={formatLabel("hairline.recession_level")}
            score={recession.score}
            argument={recession.argument}
            language={language}
            scrollTargetId={workerMetricAnchorId(
              WORKER_KEY,
              "hairline.recession_level",
            )}
          />
        </SectionShell>
      </div>
    </div>
  );
}
