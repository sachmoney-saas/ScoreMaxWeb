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
}: {
  selected: TextureKey | null;
  language: AppLanguage;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TEXTURES.map((t) => {
        const isActive = t.key === selected;
        return (
          <div
            key={t.key}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
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
          </div>
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
}

export function HairWorkerView({ aggregates, language }: HairWorkerViewProps) {
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

  const overall = getScore(aggregates, "overall_hair");

  // Quality
  const density = getScore(aggregates, "hair_quality.density");
  const strand = getScore(aggregates, "hair_quality.strand_thickness");
  const shine = getScore(aggregates, "hair_quality.shine");
  const health = getScore(aggregates, "hair_quality.health_appearance");
  const uniformity = getScore(aggregates, "hair_quality.uniformity");

  // Characteristics
  const textureEnum = getEnum(aggregates, "hair_characteristics.texture_type");
  const textureKey = normalizeTexture(textureEnum.value);
  const textureDisplay = formatEnumValue(
    "hair_characteristics.texture_type",
    textureEnum.value,
  );
  const curlDef = getScore(aggregates, "hair_characteristics.curl_definition");
  const lengthEnum = getEnum(aggregates, "hair_characteristics.length_category");

  // Hairline (metrics only — shape gallery removed)
  const hairlineSym = getScore(aggregates, "hairline.symmetry");
  const hairlineDensity = getScore(aggregates, "hairline.density");
  const recession = getScore(aggregates, "hairline.recession_level");

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
        rightSlot={
          textureDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Texture", fr: "Texture" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {textureDisplay}
              </p>
            </div>
          ) : null
        }
      />

      {/* Texture gallery */}
      <Card className={workerSectionCardClassName}>
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
          <TextureGallery selected={textureKey} language={language} />
        </CardContent>
      </Card>

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, { en: "Hair quality", fr: "Qualité capillaire" })}
          title={i18n(language, {
            en: "Strand & shine",
            fr: "Mèches et brillance",
          })}
        >
          <ScoreBar
            label={formatLabel("hair_quality.density")}
            score={density.score}
            argument={density.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("hair_quality.strand_thickness")}
            score={strand.score}
            argument={strand.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("hair_quality.shine")}
            score={shine.score}
            argument={shine.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("hair_quality.health_appearance")}
            score={health.score}
            argument={health.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("hair_quality.uniformity")}
            score={uniformity.score}
            argument={uniformity.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
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
          eyebrow={i18n(language, { en: "Hairline detail", fr: "Détail de la ligne" })}
          title={i18n(language, {
            en: "Symmetry & recession",
            fr: "Symétrie et recul",
          })}
        >
          <ScoreBar
            label={formatLabel("hairline.symmetry")}
            score={hairlineSym.score}
            argument={hairlineSym.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("hairline.density")}
            score={hairlineDensity.score}
            argument={hairlineDensity.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("hairline.recession_level")}
            score={recession.score}
            argument={recession.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
