import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { analysisSurfaceCardClassName } from "@/components/analysis/analysis-styles";
import {
  ScoreRing,
  hardmaxxingTakeawayRankPillClassName,
  scoreRingMatchMetallicPillClassName,
  softmaxxingTakeawayRankPillClassName,
} from "@/components/analysis/workers/_shared";
import { cn } from "@/lib/utils";
import {
  getScoreRank,
  GLOBAL_TIER_SEGMENTS,
  SCORE_TIERS,
} from "@/lib/global-score-tiers";
import { i18n, type AppLanguage } from "@/lib/i18n";

/** Score global factice pour aligner paliers / curseur comme sur une vraie fiche. */
const MOCK_GLOBAL_SCORE = 51;

const KEY_BLUR =
  "inline-block max-w-full blur-[5px] motion-safe:sm:blur-[6px] select-none";

function KeyBlur({ children }: { children: React.ReactNode }) {
  return <span className={KEY_BLUR}>{children}</span>;
}

function tierLadderCursorPercent(score0to100: number, rankIndex: number): number {
  const n = SCORE_TIERS.length;
  const seg = GLOBAL_TIER_SEGMENTS[rankIndex];
  if (!seg) return 0;
  const { lower, upper } = seg;
  const span = Math.max(1e-6, upper - lower);
  const clamped = Math.max(lower, Math.min(upper, score0to100));
  const t = (clamped - lower) / span;
  return ((rankIndex + Math.max(0, Math.min(1, t))) / n) * 100;
}

const PSL_SIMPLE_HORIZON_TIER_INDEX = 6;

type TrajectoryMilestone = { label: string; tierIndex: number };

function tierTrajectoryMilestones(
  activeIndex: number,
  language: AppLanguage,
): TrajectoryMilestone[] {
  const n = SCORE_TIERS.length;
  const lastIdx = n - 1;

  if (activeIndex >= lastIdx) {
    return [];
  }

  const columnCenterPct = (columnIndex: number): number => {
    const ci = Math.max(0, Math.min(lastIdx, columnIndex));
    return ((ci + 0.5) / n) * 100;
  };

  const nextColumn = activeIndex + 1;
  const nextCenter = columnCenterPct(nextColumn);

  if (activeIndex >= PSL_SIMPLE_HORIZON_TIER_INDEX) {
    return [
      {
        label: i18n(language, { en: "~ 3 mois", fr: "~ 3 mois" }),
        tierIndex: nextColumn,
      },
    ];
  }

  const milestones: TrajectoryMilestone[] = [
    {
      label: i18n(language, { en: "~ 1 mois", fr: "~ 1 mois" }),
      tierIndex: nextColumn,
    },
  ];

  const targetColumn = Math.min(activeIndex + 3, lastIdx);
  const farCenter = columnCenterPct(targetColumn);

  if (targetColumn > nextColumn && farCenter > nextCenter + 4) {
    milestones.push({
      label: i18n(language, { en: "~ 6 mois", fr: "~ 6 mois" }),
      tierIndex: targetColumn,
    });
  }

  return milestones;
}

function MockTierLadder({
  activeIndex,
  pslLabel,
  language,
  score0to100,
}: {
  activeIndex: number;
  pslLabel: string;
  language: AppLanguage;
  score0to100: number;
}) {
  const lastIdx = SCORE_TIERS.length - 1;
  const cursorLeftPct = tierLadderCursorPercent(score0to100, activeIndex);
  const trajectoryMilestones = tierTrajectoryMilestones(activeIndex, language);
  const milestoneLabelByTier = new Map(
    trajectoryMilestones.map((m) => [m.tierIndex, m.label]),
  );

  return (
    <div className="space-y-2">
      <div className="relative pb-px">
        <div className="relative">
          <div
            className="flex items-center gap-1"
            role="presentation"
            aria-hidden
          >
            {SCORE_TIERS.map((_, i) => {
              const isActive = i === activeIndex;
              const isPast = i < activeIndex;
              const isNext = !isActive && !isPast && i === activeIndex + 1;
              return (
                <div key={i} className="flex flex-1 items-center gap-1">
                  <div
                    className={cn(
                      "relative h-1.5 flex-1 overflow-hidden rounded-full transition",
                      isActive &&
                        "bg-gradient-to-b from-white/90 to-zinc-400/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_0_0_1px_rgba(255,255,255,0.12),0_2px_8px_rgba(0,0,0,0.35)]",
                      isPast && "bg-white/40",
                      isNext &&
                        "bg-white/[0.14] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]",
                      !isActive && !isPast && !isNext && "bg-white/10",
                    )}
                  >
                    {isNext ? (
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 w-[min(90%,4rem)] min-w-[1.25rem] rounded-full bg-gradient-to-r from-transparent via-white/55 to-transparent motion-safe:animate-brand-loader-shimmer motion-reduce:opacity-70"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
            <div
              className="absolute top-1/2 h-7 w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-white via-white to-white/25 shadow-[0_0_16px_rgba(255,255,255,0.45),0_0_0_0.5px_rgba(255,255,255,0.85)] blur-[5px] motion-safe:sm:blur-[6px] motion-reduce:h-6 motion-reduce:shadow-[0_0_10px_rgba(255,255,255,0.3)] sm:h-8"
              style={{ left: `${cursorLeftPct}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className="grid gap-x-0 text-center"
        style={{
          gridTemplateColumns: `repeat(${SCORE_TIERS.length}, minmax(0, 1fr))`,
        }}
      >
        {SCORE_TIERS.map((_, i) => {
          const pslNode =
            i === activeIndex ? (
              <KeyBlur>
                <span className="font-display text-[11px] font-bold leading-none tabular-nums text-white sm:text-xs">
                  {pslLabel}
                </span>
              </KeyBlur>
            ) : null;

          const milestoneLabel = milestoneLabelByTier.get(i);
          const milestoneNode = milestoneLabel ? (
            <KeyBlur>
              <span className="text-center font-sans text-[9px] font-semibold uppercase leading-snug tracking-wide text-white sm:text-[10px]">
                {milestoneLabel}
              </span>
            </KeyBlur>
          ) : null;

          const rowClassName =
            "flex min-h-[2.25rem] min-w-0 flex-row flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 px-0.5 text-center";

          if (i === 0) {
            return (
              <div key={i} className={rowClassName}>
                <span className="text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-white sm:text-[10px]">
                  {i18n(language, {
                    en: "Lowest Tier",
                    fr: "Palier minimal",
                  })}
                </span>
                {pslNode}
              </div>
            );
          }

          if (i === lastIdx) {
            return (
              <div key={i} className={rowClassName}>
                {pslNode}
                {milestoneNode}
                <span className="text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-white sm:text-[10px]">
                  {i18n(language, {
                    en: "Highest Tier",
                    fr: "Palier maximal",
                  })}
                </span>
              </div>
            );
          }

          return (
            <div key={i} className={rowClassName}>
              {milestoneNode}
              {pslNode}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TakeRow = { label: string; score: string };

function MockTakeawayColumn({
  tone,
  title,
  rows,
}: {
  tone: "positive" | "negative";
  title: string;
  rows: TakeRow[];
}) {
  const isPositive = tone === "positive";
  const accent = isPositive
    ? {
        pill: softmaxxingTakeawayRankPillClassName,
        score: "text-emerald-200",
      }
    : {
        pill: hardmaxxingTakeawayRankPillClassName,
        score: "text-red-300",
      };

  return (
    <div className="w-full min-w-0 flex-1 basis-0 space-y-3">
      <p
        className={cn(
          "text-center text-[10px] font-bold uppercase tracking-[0.2em] sm:text-[11px]",
          isPositive ? "text-emerald-200" : "text-red-200",
        )}
      >
        {title}
      </p>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={row.label}>
            <div
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-left",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md font-display text-[10px] font-bold tabular-nums sm:h-8 sm:w-8 sm:text-[11px]",
                  accent.pill,
                )}
              >
                <span className="relative z-10">{index + 1}</span>
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-xs font-semibold text-white sm:text-sm">
                {row.label}
              </span>
              <KeyBlur>
                <span
                  className={cn(
                    "shrink-0 font-display text-xs font-bold tabular-nums sm:text-sm",
                    accent.score,
                  )}
                >
                  {row.score}
                  <span className="ml-0.5 text-[9px] font-semibold text-zinc-500">
                    /10
                  </span>
                </span>
              </KeyBlur>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MockWorkerSnippet({
  title,
  scoreLabel,
  bodyFr,
  bodyEn,
  language,
}: {
  title: string;
  scoreLabel: string;
  bodyFr: string;
  bodyEn: string;
  language: AppLanguage;
}) {
  return (
    <Card className={analysisSurfaceCardClassName}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
            {title}
          </p>
          <KeyBlur>
            <span className="shrink-0 font-display text-lg font-bold tabular-nums text-white sm:text-xl">
              {scoreLabel}
            </span>
          </KeyBlur>
        </div>
        <KeyBlur>
          <p className="text-left text-xs leading-relaxed text-zinc-300 [text-wrap:pretty]">
            {language === "fr" ? bodyFr : bodyEn}
          </p>
        </KeyBlur>
      </CardContent>
    </Card>
  );
}

export function OnboardingPotentialAnalysisMock({
  language,
}: {
  language: AppLanguage;
}) {
  const rank = getScoreRank(MOCK_GLOBAL_SCORE);
  const prevTierName =
    rank.index > 0
      ? language === "fr"
        ? SCORE_TIERS[rank.index - 1].progressName.fr
        : SCORE_TIERS[rank.index - 1].progressName.en
      : null;
  const nextTierName =
    rank.index < SCORE_TIERS.length - 1
      ? language === "fr"
        ? SCORE_TIERS[rank.index + 1].progressName.fr
        : SCORE_TIERS[rank.index + 1].progressName.en
      : null;

  const strengths: TakeRow[] =
    language === "fr"
      ? [
          { label: "Peau", score: "6.13" },
          { label: "Sourcils", score: "6.00" },
          { label: "Menton", score: "5.90" },
        ]
      : [
          { label: "Skin", score: "6.13" },
          { label: "Eyebrows", score: "6.00" },
          { label: "Chin", score: "5.90" },
        ];

  const weaknesses: TakeRow[] =
    language === "fr"
      ? [
          { label: "Joues", score: "3.57" },
          { label: "Yeux", score: "4.31" },
          { label: "Symétrie", score: "4.36" },
        ]
      : [
          { label: "Cheeks", score: "3.57" },
          { label: "Eyes", score: "4.31" },
          { label: "Symmetry", score: "4.36" },
        ];

  return (
    <div className="mt-1 w-full space-y-4 pb-2 sm:mt-2 sm:space-y-5">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {i18n(language, {
          en: "Analysis preview (illustration)",
          fr: "Aperçu analyse (illustration)",
        })}
      </p>

      <Card className={analysisSurfaceCardClassName}>
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.06] blur-3xl"
          aria-hidden
        />
        <CardContent className="relative space-y-5 p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,38%)_minmax(0,1fr)] lg:items-stretch xl:grid-cols-[minmax(0,34%)_minmax(0,1fr)] xl:gap-10">
            <div className="order-1 flex min-w-0 flex-col items-center text-center lg:order-none lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:pt-0.5">
              <div className="flex w-full flex-col items-center">
                <div className="flex flex-row flex-nowrap items-center justify-center">
                  <div className="relative shrink-0 blur-[3.5px] motion-safe:sm:blur-[4px]">
                    <ScoreRing
                      score={MOCK_GLOBAL_SCORE}
                      scale={100}
                      fractionDigits={1}
                      className="h-36 w-36 sm:h-40 sm:w-40"
                    />
                  </div>
                </div>
                <p className="mt-2 max-w-full truncate px-2 text-center font-display text-lg font-semibold leading-tight tracking-tight text-white sm:text-xl">
                  <KeyBlur>augustindvck</KeyBlur>
                </p>
                <div className="mx-auto mt-1.5 w-full min-w-0 max-w-full sm:mt-2">
                  <div className="max-w-full overflow-x-auto overflow-y-hidden [scrollbar-width:thin]">
                    <div className="flex justify-center">
                      <div
                        className={cn(
                          "relative w-max px-4 py-2.5 text-center",
                          scoreRingMatchMetallicPillClassName,
                        )}
                      >
                        <p className="relative z-10 max-w-[min(100vw-4rem,22rem)] whitespace-normal px-1 font-display text-sm font-bold leading-snug text-zinc-900 sm:text-base [text-shadow:0_1px_0_rgba(255,255,255,0.65)]">
                          <KeyBlur>{rank.title}</KeyBlur>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mx-auto mt-3 max-w-[18rem] space-y-1 text-center text-[11px] leading-snug text-zinc-400 sm:max-w-[22rem] sm:text-xs">
                  <p>
                    <KeyBlur>
                      {language === "fr" ? (
                        <>
                          <span className="font-semibold tabular-nums text-zinc-300">
                            6
                          </span>{" "}
                          points au-dessus du palier{" "}
                          <span className="font-medium text-zinc-300">
                            {prevTierName ?? "—"}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold tabular-nums text-zinc-300">
                            6
                          </span>{" "}
                          points above{" "}
                          <span className="font-medium text-zinc-300">
                            {prevTierName ?? "—"}
                          </span>
                        </>
                      )}
                    </KeyBlur>
                  </p>
                  <p>
                    <KeyBlur>
                      {language === "fr" ? (
                        <>
                          <span className="font-semibold tabular-nums text-zinc-300">
                            4
                          </span>{" "}
                          points avant d&apos;atteindre{" "}
                          <span className="font-medium text-zinc-300">
                            {nextTierName ?? "—"}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold tabular-nums text-zinc-300">
                            4
                          </span>{" "}
                          points to reach{" "}
                          <span className="font-medium text-zinc-300">
                            {nextTierName ?? "—"}
                          </span>
                        </>
                      )}
                    </KeyBlur>
                  </p>
                </div>
              </div>
            </div>

            <div className="order-3 flex min-w-0 flex-col justify-center border-t border-white/10 pt-8 lg:order-none lg:col-start-2 lg:row-start-1 lg:h-full lg:border-l lg:border-t-0 lg:border-white/10 lg:pl-6 lg:pt-2 xl:pl-8">
              <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-start sm:justify-center sm:gap-4 lg:mt-1 lg:gap-5">
                <MockTakeawayColumn
                  tone="positive"
                  title={i18n(language, {
                    en: "STRENGTHS",
                    fr: "POINTS FORTS",
                  })}
                  rows={strengths}
                />
                <MockTakeawayColumn
                  tone="negative"
                  title={i18n(language, {
                    en: "WEAKNESSES",
                    fr: "POINTS FAIBLES",
                  })}
                  rows={weaknesses}
                />
              </div>
            </div>

            <div className="order-2 space-y-2 border-t border-white/10 pt-4 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:border-t lg:border-white/10">
              <MockTierLadder
                activeIndex={rank.index}
                pslLabel={rank.pslLabel}
                language={language}
                score0to100={MOCK_GLOBAL_SCORE}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <MockWorkerSnippet
        language={language}
        title={i18n(language, { en: "Apparent age", fr: "Âge apparent" })}
        scoreLabel={language === "fr" ? "20 ans" : "20 yrs"}
        bodyFr="Votre âge est estimé à 20 ans. Cette estimation est basée sur plusieurs observations : structure du visage, pilosité, peau et cheveux…"
        bodyEn="Your age is estimated at 20 years. This estimate is based on several observations: facial structure, facial hair, skin and hair…"
      />

      <MockWorkerSnippet
        language={language}
        title={i18n(language, {
          en: "Your global coloring",
          fr: "Ta colorimétrie globale",
        })}
        scoreLabel="—"
        bodyFr="Harmonie détectée entre peau, cheveux, sourcils et lèvres. Contraste, tons et cohérence globale…"
        bodyEn="Detected harmony across skin, hair, brows and lips. Contrast, tones and overall coherence…"
      />

      <MockWorkerSnippet
        language={language}
        title={i18n(language, { en: "Skin", fr: "Peau" })}
        scoreLabel="6.13"
        bodyFr="La peau est jugée « bonne » (score 6) : texture, marques, pores et uniformité du teint entrent dans une lecture détaillée multi-critères."
        bodyEn="Skin is rated “good” (score 6): texture, marks, pores and evenness are read through a detailed multi-criteria breakdown."
      />

      <MockWorkerSnippet
        language={language}
        title={i18n(language, { en: "Jaw", fr: "Mâchoire" })}
        scoreLabel="4.50"
        bodyFr="Forme frontale, largeur, ramus et symétrie : lecture structurelle du bas du visage et de l’angle gonial."
        bodyEn="Frontal shape, width, ramus and symmetry: structural read of the lower face and gonial angle."
      />
    </div>
  );
}
