import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { i18n, type AppLanguage } from "@/lib/i18n";
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
 * 2D Composition matrix — Leanness × Angularity
 *
 * Inspired by the brow "Bold/Subtle × Feminine/Masculine" matrix in the
 * inspiration deck. We build a 5×5 grid where the user's marker is positioned
 * by averaging two semantic axes:
 *
 *   X axis — Leanness  : facial_leanness_score
 *   Y axis — Sharpness : avg(jawline_definition, zygomatic_bone_visibility,
 *                            facial_angularity)
 * ------------------------------------------------------------------------- */

function CompositionMatrix({
  leanness,
  sharpness,
  language,
}: {
  leanness: number | null;
  sharpness: number | null;
  language: AppLanguage;
}) {
  const cols = 5;
  const rows = 5;

  // Map [0..10] → [0..cols-1]
  const xIdx =
    leanness !== null
      ? Math.min(cols - 1, Math.max(0, Math.round((leanness / 10) * (cols - 1))))
      : null;
  // Y is inverted on screen (higher sharpness = top row index 0)
  const yIdx =
    sharpness !== null
      ? Math.min(
          rows - 1,
          Math.max(0, Math.round(((10 - sharpness) / 10) * (rows - 1))),
        )
      : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[28px_1fr_28px] grid-rows-[28px_1fr_28px] items-center gap-1">
        {/* top label (sharp) */}
        <div />
        <div className="text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {i18n(language, { en: "Sharp", fr: "Marqué" })}
        </div>
        <div />

        {/* left label (rounded) */}
        <div className="rotate-[-90deg] text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {i18n(language, { en: "Soft", fr: "Doux" })}
        </div>

        {/* matrix grid */}
        <div
          className="relative aspect-square w-full rounded-2xl border border-white/10 bg-white/[0.03] p-2"
          role="img"
          aria-label="Composition matrix"
        >
          <div className="grid h-full w-full grid-cols-5 grid-rows-5 gap-1">
            {Array.from({ length: rows }).map((_, ry) =>
              Array.from({ length: cols }).map((_, cx) => {
                const isUser = xIdx === cx && yIdx === ry;
                const distance = Math.hypot(cx - (cols - 1) / 2, ry - (rows - 1) / 2);
                // background tile gets a subtle radial fade towards center
                const baseOpacity = Math.max(0.04, 0.18 - distance * 0.04);
                return (
                  <div
                    key={`cell-${ry}-${cx}`}
                    className={`rounded-md transition ${
                      isUser
                        ? "ring-2 ring-white/80"
                        : ""
                    }`}
                    style={{
                      backgroundColor: isUser
                        ? "#e9f1f4"
                        : `rgba(154,174,181,${baseOpacity})`,
                      boxShadow: isUser
                        ? "0 0 18px rgba(255,255,255,0.55)"
                        : undefined,
                    }}
                  />
                );
              }),
            )}
          </div>

          {/* axes */}
          <div className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-white/10" />
          <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/10" />
        </div>

        {/* right label (lean) */}
        <div className="rotate-90 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {i18n(language, { en: "Lean", fr: "Sec" })}
        </div>

        {/* bottom label (soft) */}
        <div />
        <div className="text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {i18n(language, { en: "Plump", fr: "Plein" })}
        </div>
        <div />
      </div>

      <div className="grid grid-cols-2 gap-3 text-[11px] leading-relaxed text-zinc-400 sm:grid-cols-4">
        <div>
          <p className="font-semibold text-zinc-200">
            {i18n(language, { en: "Soft & plump", fr: "Doux et plein" })}
          </p>
          <p className="text-xs">
            {i18n(language, {
              en: "Higher fat, smoother contours.",
              fr: "Plus de gras, contours adoucis.",
            })}
          </p>
        </div>
        <div>
          <p className="font-semibold text-zinc-200">
            {i18n(language, { en: "Sharp & plump", fr: "Marqué et plein" })}
          </p>
          <p className="text-xs">
            {i18n(language, {
              en: "Strong bones under fuller flesh.",
              fr: "Os marqués sous un visage plein.",
            })}
          </p>
        </div>
        <div>
          <p className="font-semibold text-zinc-200">
            {i18n(language, { en: "Soft & lean", fr: "Doux et sec" })}
          </p>
          <p className="text-xs">
            {i18n(language, {
              en: "Lean tissue, rounded structure.",
              fr: "Tissus secs, structure arrondie.",
            })}
          </p>
        </div>
        <div>
          <p className="font-semibold text-zinc-200">
            {i18n(language, { en: "Sharp & lean", fr: "Marqué et sec" })}
          </p>
          <p className="text-xs">
            {i18n(language, {
              en: "Defined bones, very low fat.",
              fr: "Os définis, peu de gras.",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Region pill — small visual showing how the score breaks down on a face area
 * ------------------------------------------------------------------------- */

function RegionPill({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  if (score === null) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
        <span className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
          {label}
        </span>
        <span className="text-xs text-zinc-500">—</span>
      </div>
    );
  }
  const band = bandFromScore(score);
  const dotColor =
    band === "excellent"
      ? "bg-emerald-300"
      : band === "good"
        ? "bg-lime-300"
        : band === "moderate"
          ? "bg-amber-300"
          : "bg-rose-300";
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-300">
          {label}
        </span>
      </div>
      <span className="font-display text-sm font-bold tabular-nums text-white">
        {score.toFixed(score % 1 === 0 ? 0 : 1)}
        <span className="ml-0.5 text-[10px] font-semibold text-zinc-500">
          /10
        </span>
      </span>
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

  // Sharpness axis = avg of bone-definition signals
  const sharpnessSignals = [
    jawline.score,
    zygomatic.score,
    angularity.score,
  ].filter((v): v is number => v !== null);
  const sharpness =
    sharpnessSignals.length > 0
      ? sharpnessSignals.reduce((a, b) => a + b, 0) / sharpnessSignals.length
      : null;

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
        score={facialLeanness.score}
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
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, {
                  en: "Composition matrix",
                  fr: "Matrice de composition",
                })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Leanness × bone definition",
                  fr: "Minceur × définition osseuse",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "Two faces with the same leanness can read very differently depending on bone structure. The matrix combines both signals so you see the full picture.",
                  fr: "Deux visages aussi secs peuvent rendre très différemment selon la structure osseuse. La matrice combine les deux signaux pour une lecture complète.",
                })}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <RegionPill
                  label={i18n(language, { en: "Leanness", fr: "Minceur" })}
                  score={facialLeanness.score}
                />
                <RegionPill
                  label={i18n(language, { en: "Sharpness", fr: "Marqué" })}
                  score={sharpness}
                />
              </div>
            </div>
            <CompositionMatrix
              leanness={facialLeanness.score}
              sharpness={sharpness}
              language={language}
            />
          </div>
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
