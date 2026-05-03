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
 * Hairline gallery — common frontal hairline shapes
 * ------------------------------------------------------------------------- */

type HairlineShape =
  | "straight"
  | "rounded"
  | "widows_peak"
  | "m_shape"
  | "low"
  | "uneven";

const HAIRLINES: {
  key: HairlineShape;
  label: { en: string; fr: string };
  d: string;
}[] = [
  {
    key: "straight",
    label: { en: "Straight", fr: "Droite" },
    d: "M10 20 L90 20 L90 70 L10 70 Z",
  },
  {
    key: "rounded",
    label: { en: "Rounded", fr: "Arrondie" },
    d: "M10 30 Q50 12 90 30 L90 70 L10 70 Z",
  },
  {
    key: "widows_peak",
    label: { en: "Widow's peak", fr: "Pointe de veuve" },
    d: "M10 20 L42 20 L50 32 L58 20 L90 20 L90 70 L10 70 Z",
  },
  {
    key: "m_shape",
    label: { en: "M-shape", fr: "Forme en M" },
    d: "M10 26 L26 18 L42 28 L50 18 L58 28 L74 18 L90 26 L90 70 L10 70 Z",
  },
  {
    key: "low",
    label: { en: "Low", fr: "Basse" },
    d: "M10 14 Q50 6 90 14 L90 70 L10 70 Z",
  },
  {
    key: "uneven",
    label: { en: "Uneven", fr: "Asymétrique" },
    d: "M10 22 L34 18 L52 26 L72 16 L90 22 L90 70 L10 70 Z",
  },
];

const HAIRLINE_ALIASES: Record<string, HairlineShape> = {
  straight: "straight",
  droite: "straight",
  flat: "straight",
  rounded: "rounded",
  arrondie: "rounded",
  curved: "rounded",
  widows_peak: "widows_peak",
  "widow's_peak": "widows_peak",
  pointe_de_veuve: "widows_peak",
  peak: "widows_peak",
  m_shape: "m_shape",
  m_shaped: "m_shape",
  forme_en_m: "m_shape",
  low: "low",
  basse: "low",
  uneven: "uneven",
  asymmetric: "uneven",
  asymmetrique: "uneven",
  asymétrique: "uneven",
};

function normalizeHairline(value: string | null): HairlineShape | null {
  if (!value) return null;
  const k = value
    .toLowerCase()
    .trim()
    .replace(/'/g, "")
    .replace(/\s+/g, "_");
  return HAIRLINE_ALIASES[k] ?? null;
}

function HairlineGallery({
  selected,
  language,
}: {
  selected: HairlineShape | null;
  language: AppLanguage;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {HAIRLINES.map((shape) => {
        const isActive = shape.key === selected;
        return (
          <div
            key={shape.key}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
              isActive
                ? "border-white/45 bg-white/[0.08] shadow-[0_0_28px_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <svg viewBox="0 0 100 80" className="h-14 w-20" role="img">
              {/* Forehead skin */}
              <rect
                x={6}
                y={6}
                width={88}
                height={68}
                rx={6}
                fill="rgba(154,174,181,0.08)"
              />
              <path
                d={shape.d}
                fill={
                  isActive ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.55)"
                }
                stroke={
                  isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)"
                }
                strokeWidth={1}
                strokeLinejoin="round"
              />
            </svg>
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
                isActive ? "text-white" : "text-zinc-500"
              }`}
            >
              {i18n(language, shape.label)}
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
 * Density visualization — dot grid that fills with density score
 * ------------------------------------------------------------------------- */

function DensityGrid({
  score,
  language,
  label,
}: {
  score: number | null;
  language: AppLanguage;
  label: string;
}) {
  const cells = 60;
  const filled =
    score === null
      ? 0
      : Math.min(cells, Math.max(0, Math.round((score / 10) * cells)));
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <span className="font-display text-base font-bold tabular-nums text-white">
          {score === null ? "—" : `${score.toFixed(score % 1 === 0 ? 0 : 1)}/10`}
        </span>
      </div>
      <div className="grid grid-cols-12 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        {Array.from({ length: cells }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              i < filled ? "bg-[#e9f1f4]" : "bg-white/[0.08]"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        <span>{i18n(language, { en: "Sparse", fr: "Clairsemée" })}</span>
        <span>{i18n(language, { en: "Dense", fr: "Dense" })}</span>
      </div>
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

  // Hairline
  const hairlineEnum = getEnum(aggregates, "hairline.shape");
  const hairlineKey = normalizeHairline(hairlineEnum.value);
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
        score={overall.score}
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

      {/* Hairline gallery */}
      {hairlineEnum.value ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Hairline", fr: "Ligne capillaire" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Frontal shape",
                  fr: "Forme frontale",
                })}
              </h3>
              {hairlineEnum.argument ? (
                <p className="text-sm leading-relaxed text-zinc-400">
                  {hairlineEnum.argument}
                </p>
              ) : null}
            </div>
            <HairlineGallery selected={hairlineKey} language={language} />
          </CardContent>
        </Card>
      ) : null}

      {/* Density grid */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="space-y-4 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, { en: "Density", fr: "Densité" })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Coverage density",
                fr: "Densité de couverture",
              })}
            </h3>
          </div>
          <DensityGrid
            score={density.score}
            label={formatLabel("hair_quality.density")}
            language={language}
          />
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
