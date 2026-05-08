import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { calculateWorkerFaceScore, SCOREMAX_OVERALL_SCORE_KEYS } from "@/lib/face-analysis-score";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  coloringSkinTintHeroBlock,
  getEnum,
  getScore,
  hasAnyScore,
  mergeHeroRightSlot,
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
    description: {
      en: "Very fair — burns fast, almost never tans",
      fr: "Très claire — brûle vite, ne bronze presque pas",
    },
  },
  {
    key: "ii",
    label: "II",
    color: "#e8c0a3",
    description: {
      en: "Fair — burns easily, tans a little",
      fr: "Claire — brûle facilement, bronze peu",
    },
  },
  {
    key: "iii",
    label: "III",
    color: "#cf9874",
    description: {
      en: "Medium — sometimes burns, tans gradually",
      fr: "Ni trop claire ni foncée — brûle parfois, bronze doucement",
    },
  },
  {
    key: "iv",
    label: "IV",
    color: "#a87752",
    description: {
      en: "Olive / brown tone — rarely burns, tans easily",
      fr: "Mate — brûle rarement, bronze assez facilement",
    },
  },
  {
    key: "v",
    label: "V",
    color: "#7c5634",
    description: {
      en: "Brown — very rarely burns, tans very easily",
      fr: "Brune — brûle très rarement, bronze vite",
    },
  },
  {
    key: "vi",
    label: "VI",
    color: "#3d2418",
    description: {
      en: "Deep brown — almost never burns",
      fr: "Très foncée — ne brûle pratiquement jamais",
    },
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
            {i18n(language, {
              en: "In plain words",
              fr: "En clair",
            })}
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
      label: { en: "Rosy", fr: "Rosée" },
      color: "#a3b5d6",
      description: {
        en: "Your skin leans pink or slightly blue underneath",
        fr: "Sous la peau, ça tire plutôt rose ou légèrement bleuté",
      },
    },
    {
      key: "neutral",
      label: { en: "Balanced", fr: "Équilibré" },
      color: "#c8b89a",
      description: {
        en: "Not clearly pink or golden — in between",
        fr: "Ni vraiment rose ni vraiment doré — un juste milieu",
      },
    },
    {
      key: "warm",
      label: { en: "Golden", fr: "Dorée" },
      color: "#e3b87c",
      description: {
        en: "Your skin leans yellow, peach or gold underneath",
        fr: "Sous la peau, ça tire plutôt doré ou pêche",
      },
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
  heroAside?: React.ReactNode;
}

export function SkinTintWorkerView({
  aggregates,
  language,
  heroAside,
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

  const tintHero = coloringSkinTintHeroBlock(language);

  const heroArgument = React.useMemo(() => {
    const keys = SCOREMAX_OVERALL_SCORE_KEYS[WORKER_KEY];
    if (!keys) return null;
    for (const k of keys) {
      const s = getScore(aggregates, k);
      const a = s.argument?.trim();
      if (a) return a;
    }
    return null;
  }, [aggregates]);

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

  // Sun / tan
  const tanLevel = getEnum(aggregates, "sun_exposure_aesthetic.tan_level");
  const tanUniformity = getScore(
    aggregates,
    "sun_exposure_aesthetic.tan_uniformity",
  );
  const tanHarmony = getScore(
    aggregates,
    "sun_exposure_aesthetic.tan_phototype_harmony",
  );

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={tintHero.eyebrow}
        title={tintHero.title}
        argument={heroArgument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={mergeHeroRightSlot(
          fitzDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, {
                  en: "Natural depth (I–VI)",
                  fr: "Niveau naturel (I–VI)",
                })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {fitzDisplay}
              </p>
            </div>
          ) : null,
          heroAside,
        )}
      />

      {/* Fitzpatrick scale */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, {
                en: "Natural skin depth",
                fr: "Profondeur naturelle du teint",
              })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "From very fair to deep — and how you react in the sun",
                fr: "Du très clair au foncé — et ta peau au soleil",
              })}
            </h3>
            <p className="text-sm leading-relaxed text-zinc-500">
              {i18n(language, {
                en: "Six steps for natural tone: mainly whether you burn easily or tan without burning — not makeup.",
                fr: "Six repères sur ton teint naturel : surtout si tu brûles vite ou si tu bronzes sans brûler — pas le maquillage.",
              })}
            </p>
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
                {i18n(language, {
                  en: "Undertone",
                  fr: "Reflet du teint",
                })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Pinkish, balanced or golden underneath",
                  fr: "Plutôt rosé, équilibré ou doré en dessous",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-500">
                {i18n(language, {
                  en: "Under the surface color — the hue that shows through your skin.",
                  fr: "Ce n’est pas la couleur qu’on voit tout de suite : c’est la nuance qui transparaît sous le teint.",
                })}
              </p>
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
          when={hasAnyScore(radiance.score, sallowness.score)}
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
          when={hasAnyScore(melanin.score, periMatch.score)}
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
          when={
            hasAnyScore(tanUniformity.score, tanHarmony.score) ||
            Boolean(tanLevel.value)
          }
          eyebrow={i18n(language, { en: "Sun & tan", fr: "Soleil et bronzage" })}
          title={i18n(language, {
            en: "Tan level & phototype harmony",
            fr: "Bronzage et harmonie phototype",
          })}
        >
          {tanLevel.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("sun_exposure_aesthetic.tan_level")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "sun_exposure_aesthetic.tan_level",
                    tanLevel.value,
                  ) ?? tanLevel.value}
                </span>
              </div>
              {tanLevel.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {tanLevel.argument}
                </p>
              ) : null}
            </div>
          ) : null}
          <ScoreBar
            label={formatLabel("sun_exposure_aesthetic.tan_uniformity")}
            score={tanUniformity.score}
            argument={tanUniformity.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("sun_exposure_aesthetic.tan_phototype_harmony")}
            score={tanHarmony.score}
            argument={tanHarmony.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
