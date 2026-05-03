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
  CompositionMatrix,
  getBodyfatCompositionSharpness,
} from "./BodyfatCompositionMatrix";
import {
  bandFromScore,
  getEnum,
  getScore,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "bodyfat";

/* ----------------------------------------------------------------------------
 * Visual tier scale
 *
 * The backend can return any of these values for `visual_estimate_tier`. We
 * map all of them to a canonical 0..5 position on a "soft → lean" axis so the
 * scale has a consistent mental model regardless of the labeling style used by
 * a given run.
 * ------------------------------------------------------------------------- */

type TierKey =
  | "obese"
  | "overweight"
  | "average_soft"
  | "athletic_lean"
  | "model_shredded"
  | "extreme_gaunt";

const CANONICAL_TIERS: {
  key: TierKey;
  en: string;
  fr: string;
  emoji: string;
  color: string;
}[] = [
  { key: "obese", en: "Obese", fr: "Obèse", emoji: "○", color: "#3a4a52" },
  {
    key: "overweight",
    en: "Overweight",
    fr: "Surpoids",
    emoji: "◐",
    color: "#536974",
  },
  {
    key: "average_soft",
    en: "Average / soft",
    fr: "Moyen / doux",
    emoji: "◑",
    color: "#788d96",
  },
  {
    key: "athletic_lean",
    en: "Athletic lean",
    fr: "Athlétique sec",
    emoji: "◔",
    color: "#9fb4bb",
  },
  {
    key: "model_shredded",
    en: "Model shredded",
    fr: "Sec type modèle",
    emoji: "◕",
    color: "#c5d6db",
  },
  {
    key: "extreme_gaunt",
    en: "Extreme gaunt",
    fr: "Très émacié",
    emoji: "●",
    color: "#e9f1f4",
  },
];

const TIER_ALIASES: Record<string, TierKey> = {
  // canonical
  obese: "obese",
  overweight: "overweight",
  average_soft: "average_soft",
  athletic_lean: "athletic_lean",
  model_shredded: "model_shredded",
  extreme_gaunt: "extreme_gaunt",
  // legacy / alternate spellings observed in display.ts
  soft: "overweight",
  average: "average_soft",
  lean: "athletic_lean",
  lean_athletic: "athletic_lean",
};

function normalizeTier(value: string | null): TierKey | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return TIER_ALIASES[k] ?? null;
}

function VisualTierScale({
  selected,
  argument,
  language,
}: {
  selected: TierKey | null;
  argument: string | null;
  language: AppLanguage;
}) {
  const idx = selected
    ? CANONICAL_TIERS.findIndex((t) => t.key === selected)
    : -1;
  const total = CANONICAL_TIERS.length;
  const pct = idx >= 0 ? ((idx + 0.5) / total) * 100 : null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">
          {i18n(language, {
            en: "Visual tier",
            fr: "Niveau visuel",
          })}
        </span>
        <span className="text-sm font-semibold text-white">
          {idx >= 0
            ? i18n(language, {
                en: CANONICAL_TIERS[idx].en,
                fr: CANONICAL_TIERS[idx].fr,
              })
            : "—"}
        </span>
      </div>

      <div className="relative">
        {/* gradient bar */}
        <div className="relative h-12 w-full overflow-hidden rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex h-full w-full">
            {CANONICAL_TIERS.map((tier) => (
              <div
                key={tier.key}
                className="h-full flex-1"
                style={{ backgroundColor: tier.color }}
              />
            ))}
          </div>
          {/* segment dividers */}
          {CANONICAL_TIERS.slice(1).map((_, i) => (
            <div
              key={`div-${i}`}
              className="absolute inset-y-0 w-px bg-black/20"
              style={{ left: `${((i + 1) / total) * 100}%` }}
            />
          ))}
          {/* marker */}
          {pct !== null ? (
            <div
              className="pointer-events-none absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
              style={{ left: `${pct}%` }}
            />
          ) : null}
        </div>

        {/* Tick labels */}
        <div className="mt-2 grid grid-cols-6 gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {CANONICAL_TIERS.map((tier, i) => (
            <span
              key={tier.key}
              className={`text-center ${i === idx ? "text-white" : ""}`}
            >
              {i18n(language, { en: tier.en, fr: tier.fr })}
            </span>
          ))}
        </div>

        {/* Axis caption */}
        <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          <span>{i18n(language, { en: "Softer", fr: "Plus doux" })}</span>
          <span>{i18n(language, { en: "Leaner", fr: "Plus sec" })}</span>
        </div>
      </div>

      {argument ? (
        <p className="text-xs leading-relaxed text-zinc-400">{argument}</p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface BodyfatWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function BodyfatWorkerView({
  aggregates,
  language,
}: BodyfatWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );

  const facialLeanness = getScore(
    aggregates,
    "body_fat_estimation.facial_leanness_score",
  );
  const tierEnum = getEnum(aggregates, "body_fat_estimation.visual_estimate_tier");
  const tierKey = normalizeTier(tierEnum.value);

  const jawline = getScore(aggregates, "lower_face_neck.jawline_definition");
  const submental = getScore(
    aggregates,
    "lower_face_neck.submental_fat_tightness",
  );
  const buccal = getScore(aggregates, "midface_buccal.buccal_leanness");
  const zygomatic = getScore(
    aggregates,
    "midface_buccal.zygomatic_bone_visibility",
  );
  const periocular = getScore(
    aggregates,
    "upper_face_skin.periocular_leanness",
  );
  const angularity = getScore(aggregates, "upper_face_skin.facial_angularity");

  const sharpness = getBodyfatCompositionSharpness(aggregates);

  const tierLabel = tierKey
    ? formatAggregateDisplayValue(
        WORKER_KEY,
        "body_fat_estimation.visual_estimate_tier",
        tierEnum.value ?? tierKey,
        locale,
      ) ??
      i18n(
        language,
        CANONICAL_TIERS.find((t) => t.key === tierKey)
          ? {
              en: CANONICAL_TIERS.find((t) => t.key === tierKey)!.en,
              fr: CANONICAL_TIERS.find((t) => t.key === tierKey)!.fr,
            }
          : { en: tierKey, fr: tierKey },
      )
    : null;

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Facial body fat",
          fr: "Masse grasse faciale",
        })}
        title={i18n(language, {
          en: "Your facial leanness",
          fr: "Ta minceur faciale",
        })}
        argument={facialLeanness.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={
          tierLabel ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, {
                  en: "Visual tier",
                  fr: "Niveau visuel",
                })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {tierLabel}
              </p>
            </div>
          ) : null
        }
      />

      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, {
                  en: "Visual estimation",
                  fr: "Estimation visuelle",
                })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Where you sit on the leanness spectrum",
                  fr: "Ta position sur le spectre de minceur",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "Six visual tiers from softer composition to extreme leanness. Your marker reflects what is currently visible on your face.",
                  fr: "Six niveaux visuels, du visage plus doux à la minceur extrême. Le curseur reflète ce qui est actuellement visible sur ton visage.",
                })}
              </p>
            </div>
            <VisualTierScale
              selected={tierKey}
              argument={tierEnum.argument}
              language={language}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <CompositionMatrix
            leanness={facialLeanness.score}
            sharpness={sharpness}
            language={language}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Lower face & neck",
            fr: "Bas du visage et cou",
          })}
          title={i18n(language, {
            en: "Jaw & submental",
            fr: "Mâchoire et menton",
          })}
        >
          <ScoreBar
            label={formatLabel("lower_face_neck.jawline_definition")}
            score={jawline.score}
            argument={jawline.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("lower_face_neck.submental_fat_tightness")}
            score={submental.score}
            argument={submental.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Midface", fr: "Milieu du visage" })}
          title={i18n(language, {
            en: "Cheeks & cheekbones",
            fr: "Joues et pommettes",
          })}
        >
          <ScoreBar
            label={formatLabel("midface_buccal.buccal_leanness")}
            score={buccal.score}
            argument={buccal.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("midface_buccal.zygomatic_bone_visibility")}
            score={zygomatic.score}
            argument={zygomatic.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Upper face",
            fr: "Haut du visage",
          })}
          title={i18n(language, {
            en: "Eye area & angularity",
            fr: "Yeux et angulosité",
          })}
        >
          <ScoreBar
            label={formatLabel("upper_face_skin.periocular_leanness")}
            score={periocular.score}
            argument={periocular.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("upper_face_skin.facial_angularity")}
            score={angularity.score}
            argument={angularity.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
