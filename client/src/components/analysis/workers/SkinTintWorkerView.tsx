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

const WORKER_KEY = "skin_tint";

/* ----------------------------------------------------------------------------
 * Fitzpatrick scale (I → VI)
 * ------------------------------------------------------------------------- */

const FITZPATRICK: {
  key: string;
  label: string;
  color: string;
  description: { en: string; fr: string };
}[] = [
  {
    key: "i",
    label: "I",
    color: "#f4dccd",
    description: { en: "Always burns", fr: "Brûle toujours" },
  },
  {
    key: "ii",
    label: "II",
    color: "#e8c0a3",
    description: { en: "Burns easily", fr: "Brûle facilement" },
  },
  {
    key: "iii",
    label: "III",
    color: "#cf9874",
    description: { en: "Sometimes burns", fr: "Brûle parfois" },
  },
  {
    key: "iv",
    label: "IV",
    color: "#a87752",
    description: { en: "Rarely burns", fr: "Brûle rarement" },
  },
  {
    key: "v",
    label: "V",
    color: "#7c5634",
    description: { en: "Very rarely burns", fr: "Brûle très rarement" },
  },
  {
    key: "vi",
    label: "VI",
    color: "#3d2418",
    description: { en: "Never burns", fr: "Ne brûle jamais" },
  },
];

const FITZPATRICK_ALIASES: Record<string, string> = {
  "1": "i",
  i: "i",
  type_1: "i",
  type_i: "i",
  "2": "ii",
  ii: "ii",
  type_2: "ii",
  type_ii: "ii",
  "3": "iii",
  iii: "iii",
  type_3: "iii",
  type_iii: "iii",
  "4": "iv",
  iv: "iv",
  type_4: "iv",
  type_iv: "iv",
  "5": "v",
  v: "v",
  type_5: "v",
  type_v: "v",
  "6": "vi",
  vi: "vi",
  type_6: "vi",
  type_vi: "vi",
};

function normalizeFitzpatrick(value: string | null): string | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return FITZPATRICK_ALIASES[k] ?? null;
}

function FitzpatrickScale({
  selected,
  language,
}: {
  selected: string | null;
  language: AppLanguage;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-2">
        {FITZPATRICK.map((shade) => {
          const isActive = shade.key === selected;
          return (
            <div
              key={shade.key}
              className={`relative flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition ${
                isActive
                  ? "border-white/45 bg-white/[0.08] shadow-[0_0_28px_rgba(255,255,255,0.08)]"
                  : "border-white/10 bg-white/[0.025]"
              }`}
            >
              <div
                className="h-12 w-full rounded-lg ring-1 ring-white/10"
                style={{ backgroundColor: shade.color }}
              />
              <span
                className={`font-display text-sm font-bold tracking-tight ${
                  isActive ? "text-white" : "text-zinc-400"
                }`}
              >
                {shade.label}
              </span>
              {isActive ? (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]" />
              ) : null}
            </div>
          );
        })}
      </div>

      {selected ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            {i18n(language, { en: "Sun reaction", fr: "Réaction au soleil" })}
          </p>
          <p className="mt-0.5 text-sm font-medium text-white">
            {i18n(
              language,
              FITZPATRICK.find((f) => f.key === selected)?.description ?? {
                en: "—",
                fr: "—",
              },
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Undertone wheel — cool / neutral / warm
 * ------------------------------------------------------------------------- */

type Undertone = "cool" | "neutral" | "warm";

const UNDERTONE_ALIASES: Record<string, Undertone> = {
  cool: "cool",
  cold: "cool",
  froid: "cool",
  pink: "cool",
  blue: "cool",
  neutral: "neutral",
  neutre: "neutral",
  olive: "neutral",
  warm: "warm",
  chaud: "warm",
  golden: "warm",
  yellow: "warm",
  peach: "warm",
};

function normalizeUndertone(value: string | null): Undertone | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return UNDERTONE_ALIASES[k] ?? null;
}

function UndertoneWheel({
  undertone,
  language,
}: {
  undertone: Undertone | null;
  language: AppLanguage;
}) {
  const items: {
    key: Undertone;
    label: { en: string; fr: string };
    color: string;
    description: { en: string; fr: string };
  }[] = [
    {
      key: "cool",
      label: { en: "Cool", fr: "Froid" },
      color: "#a3b5d6",
      description: { en: "Pink / blue base", fr: "Base rose / bleue" },
    },
    {
      key: "neutral",
      label: { en: "Neutral", fr: "Neutre" },
      color: "#c8b89a",
      description: { en: "Olive / mixed base", fr: "Base olive / mixte" },
    },
    {
      key: "warm",
      label: { en: "Warm", fr: "Chaud" },
      color: "#e3b87c",
      description: { en: "Golden / peach base", fr: "Base dorée / pêche" },
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => {
        const isActive = item.key === undertone;
        return (
          <div
            key={item.key}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-4 transition ${
              isActive
                ? "border-white/45 bg-white/[0.08] shadow-[0_0_28px_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <div
              className="h-14 w-14 rounded-full ring-2 ring-white/15"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${item.color}, ${item.color}cc 60%, ${item.color}80)`,
              }}
            />
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
                isActive ? "text-white" : "text-zinc-400"
              }`}
            >
              {i18n(language, item.label)}
            </span>
            <span className="text-center text-[10px] leading-tight text-zinc-500">
              {i18n(language, item.description)}
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

export interface SkinTintWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function SkinTintWorkerView({
  aggregates,
  language,
}: SkinTintWorkerViewProps) {
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

  const overall =
    getScore(aggregates, "overall_colorimetry_score").score !== null
      ? getScore(aggregates, "overall_colorimetry_score")
      : getScore(aggregates, "overall_colorimetry");

  // Phenotype & undertone
  const fitzEnum = getEnum(aggregates, "phenotype_and_undertone.fitzpatrick_type");
  const fitzKey = normalizeFitzpatrick(fitzEnum.value);
  const fitzDisplay = formatEnumValue(
    "phenotype_and_undertone.fitzpatrick_type",
    fitzEnum.value,
  );
  const undertoneEnum = getEnum(
    aggregates,
    "phenotype_and_undertone.skin_undertone",
  );
  const undertoneKey = normalizeUndertone(undertoneEnum.value);

  // Vitality
  const radiance = getScore(aggregates, "vitality_and_radiance.color_radiance_glow");
  const sallowness = getScore(
    aggregates,
    "vitality_and_radiance.sallowness_absence",
  );

  // Pigment distribution
  const melanin = getScore(aggregates, "pigment_distribution.melanin_uniformity");
  const periMatch = getScore(
    aggregates,
    "pigment_distribution.periorbital_perioral_match",
  );

  // Sun
  const uvAesthetic = getScore(
    aggregates,
    "sun_exposure_aesthetic.uv_exposure_aesthetic",
  );

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Skin tint", fr: "Teint" })}
        title={i18n(language, {
          en: "Your skin colorimetry",
          fr: "Ta colorimétrie de peau",
        })}
        argument={overall.argument}
        score={overall.score}
        rightSlot={
          fitzDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Fitzpatrick", fr: "Fitzpatrick" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {fitzDisplay}
              </p>
            </div>
          ) : null
        }
      />

      {/* Fitzpatrick scale */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, { en: "Phototype", fr: "Phototype" })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Where your skin sits on Fitzpatrick",
                fr: "Où ta peau se situe sur Fitzpatrick",
              })}
            </h3>
            {fitzEnum.argument ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                {fitzEnum.argument}
              </p>
            ) : null}
          </div>
          <FitzpatrickScale selected={fitzKey} language={language} />
        </CardContent>
      </Card>

      {/* Undertone */}
      {undertoneEnum.value ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Undertone", fr: "Sous-ton" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Cool, neutral or warm",
                  fr: "Froid, neutre ou chaud",
                })}
              </h3>
              {undertoneEnum.argument ? (
                <p className="text-sm leading-relaxed text-zinc-400">
                  {undertoneEnum.argument}
                </p>
              ) : null}
            </div>
            <UndertoneWheel undertone={undertoneKey} language={language} />
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, { en: "Vitality & radiance", fr: "Vitalité et éclat" })}
          title={i18n(language, {
            en: "Glow & freshness",
            fr: "Éclat et fraîcheur",
          })}
        >
          <ScoreBar
            label={formatLabel("vitality_and_radiance.color_radiance_glow")}
            score={radiance.score}
            argument={radiance.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("vitality_and_radiance.sallowness_absence")}
            score={sallowness.score}
            argument={sallowness.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Pigment distribution", fr: "Distribution pigmentaire" })}
          title={i18n(language, {
            en: "Uniformity & match",
            fr: "Uniformité et cohérence",
          })}
        >
          <ScoreBar
            label={formatLabel("pigment_distribution.melanin_uniformity")}
            score={melanin.score}
            argument={melanin.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel(
              "pigment_distribution.periorbital_perioral_match",
            )}
            score={periMatch.score}
            argument={periMatch.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Sun exposure", fr: "Exposition solaire" })}
          title={i18n(language, {
            en: "UV aesthetic mark",
            fr: "Marques esthétiques UV",
          })}
        >
          <ScoreBar
            label={formatLabel("sun_exposure_aesthetic.uv_exposure_aesthetic")}
            score={uvAesthetic.score}
            argument={uvAesthetic.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
