import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
} from "@/lib/face-analysis-display";
import { skinRadarAxisPaint } from "@/lib/face-analysis-score";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { getScore } from "./_shared";

const BODYFAT_WORKER = "bodyfat";

/** All leaf scores under facial body fat (same set as the worker detail bars). */
const BODYFAT_LEAF_SCORE_PATHS = [
  "body_fat_estimation.facial_leanness_score",
  "lower_face_neck.jawline_definition",
  "lower_face_neck.submental_fat_tightness",
  "midface_buccal.buccal_leanness",
  "midface_buccal.zygomatic_bone_visibility",
  "upper_face_skin.periocular_leanness",
  "upper_face_skin.facial_angularity",
] as const;

export function getBodyfatWeakestLeafScore(
  aggregates: Record<string, unknown>,
  locale: FaceAnalysisLocale,
): { label: string; score: number } | null {
  const candidates: { label: string; score: number }[] = [];
  for (const path of BODYFAT_LEAF_SCORE_PATHS) {
    const { score } = getScore(aggregates, path);
    if (score !== null) {
      candidates.push({
        label: formatAggregateDisplayLabel(BODYFAT_WORKER, path, locale),
        score,
      });
    }
  }
  if (candidates.length === 0) return null;

  let weakest = candidates[0]!;
  for (const c of candidates.slice(1)) {
    if (c.score < weakest.score) weakest = c;
  }
  return weakest;
}

/* ----------------------------------------------------------------------------
 * Composition matrix — quadrant legend (median split at 5 on both axes)
 * ------------------------------------------------------------------------- */

type CompositionQuadrant =
  | "soft_plump"
  | "sharp_plump"
  | "soft_lean"
  | "sharp_lean";

function compositionQuadrant(
  leanness: number | null,
  sharpness: number | null,
): CompositionQuadrant | null {
  if (leanness === null || sharpness === null) return null;
  const sec = leanness >= 5;
  const marque = sharpness >= 5;
  if (!sec && !marque) return "soft_plump";
  if (!sec && marque) return "sharp_plump";
  if (sec && !marque) return "soft_lean";
  return "sharp_lean";
}

const COMPOSITION_QUADRANT_COPY: Record<
  CompositionQuadrant,
  { title: { en: string; fr: string }; body: { en: string; fr: string } }
> = {
  soft_plump: {
    title: { en: "Soft & plump", fr: "Doux et plein" },
    body: {
      en: "Higher fat, smoother contours.",
      fr: "Plus de gras, contours adoucis.",
    },
  },
  sharp_plump: {
    title: { en: "Sharp & plump", fr: "Marqué et plein" },
    body: {
      en: "Strong bones under fuller flesh.",
      fr: "Os marqués sous un visage plein.",
    },
  },
  soft_lean: {
    title: { en: "Soft & lean", fr: "Doux et sec" },
    body: {
      en: "Lean tissue, rounded structure.",
      fr: "Tissus secs, structure arrondie.",
    },
  },
  sharp_lean: {
    title: { en: "Sharp & lean", fr: "Marqué et sec" },
    body: {
      en: "Defined bones, very low fat.",
      fr: "Os définis, peu de gras.",
    },
  },
};

function ActiveCompositionQuadrant({
  quadrant,
  language,
}: {
  quadrant: CompositionQuadrant | null;
  language: AppLanguage;
}) {
  if (!quadrant) return null;
  const row = COMPOSITION_QUADRANT_COPY[quadrant];
  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border border-white/12 bg-white/[0.04] px-4 py-4 text-center sm:px-6">
      <p className="font-semibold text-zinc-100">
        {i18n(language, row.title)}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {i18n(language, row.body)}
      </p>
    </div>
  );
}

/**
 * Axe vertical de la matrice (Marqué / « définition osseuse ») : moyenne arithmétique des métriques
 * disponibles parmi mâchoire, pommettes et angularité. Aligné avec `BodyfatWorkerView`.
 */
export function getBodyfatCompositionSharpness(
  aggregates: Record<string, unknown>,
): number | null {
  const jawline = getScore(aggregates, "lower_face_neck.jawline_definition");
  const zygomatic = getScore(
    aggregates,
    "midface_buccal.zygomatic_bone_visibility",
  );
  const angularity = getScore(aggregates, "upper_face_skin.facial_angularity");
  const sharpnessSignals = [jawline.score, zygomatic.score, angularity.score].filter(
    (v): v is number => v !== null,
  );
  return sharpnessSignals.length > 0
    ? sharpnessSignals.reduce((a, b) => a + b, 0) / sharpnessSignals.length
    : null;
}

/**
 * 10×10 grid only — for overview cards / previews.
 * Axes: leanness L→R (doux → sec), sharpness inverted vertically (plein → marqué).
 */
export function BodyfatCompositionMatrixVisual({
  leanness,
  sharpness,
  language,
  compact = false,
}: {
  leanness: number | null;
  sharpness: number | null;
  language: AppLanguage;
  compact?: boolean;
}) {
  const cols = 10;
  const rows = 10;

  const xIdx =
    leanness !== null
      ? Math.min(cols - 1, Math.max(0, Math.floor(leanness)))
      : null;
  const yIdx =
    sharpness !== null
      ? Math.min(rows - 1, Math.max(0, Math.floor(10 - sharpness)))
      : null;

  const wrapMax = compact
    ? "mx-auto w-full max-w-[13rem] sm:max-w-[14rem]"
    : "mx-auto w-full max-w-[min(100%,20rem)] sm:max-w-[22rem]";
  const gridShell = compact
    ? "grid grid-cols-[16px_1fr_16px] grid-rows-[16px_1fr_16px] items-center gap-0.5"
    : "grid grid-cols-[22px_1fr_22px] grid-rows-[22px_1fr_22px] items-center gap-0.5 sm:grid-cols-[26px_1fr_26px] sm:grid-rows-[26px_1fr_26px]";
  const labelClass = compact
    ? "text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400"
    : "text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400";
  const pad = compact ? "p-1.5" : "p-2";
  const cellGap = compact ? "gap-[2px]" : "gap-0.5";
  const cellRound = compact ? "rounded-[2px]" : "rounded-[3px] sm:rounded-sm";
  const ringUser = compact ? "ring-1 ring-white/85" : "ring-2 ring-white/80";

  return (
    <div className={wrapMax}>
      <div className={gridShell}>
        <div />
        <div className={`text-center ${labelClass}`}>
          {i18n(language, { en: "Sharp", fr: "Marqué" })}
        </div>
        <div />

        <div className="flex items-center justify-center">
          <span
            className={`inline-block origin-center rotate-[-90deg] whitespace-nowrap text-center ${labelClass}`}
          >
            {i18n(language, { en: "Soft", fr: "Doux" })}
          </span>
        </div>

        <div
          className={`relative aspect-square w-full rounded-xl border border-white/10 bg-white/[0.03] ${pad}`}
          role="img"
          aria-label={i18n(language, {
            en: "Composition matrix",
            fr: "Matrice de composition",
          })}
        >
          <div className={`grid h-full w-full grid-cols-10 grid-rows-10 ${cellGap}`}>
            {Array.from({ length: rows }).map((_, ry) =>
              Array.from({ length: cols }).map((_, cx) => {
                const isUser = xIdx === cx && yIdx === ry;
                const distance = Math.hypot(
                  cx - (cols - 1) / 2,
                  ry - (rows - 1) / 2,
                );
                const baseOpacity = Math.max(0.04, 0.18 - distance * 0.019);
                return (
                  <div
                    key={`cell-${ry}-${cx}`}
                    className={`${cellRound} transition ${isUser ? ringUser : ""}`}
                    style={{
                      backgroundColor: isUser
                        ? "#e9f1f4"
                        : `rgba(154,174,181,${baseOpacity})`,
                      boxShadow: isUser
                        ? "0 0 14px rgba(255,255,255,0.45)"
                        : undefined,
                    }}
                  />
                );
              }),
            )}
          </div>

          <div className="pointer-events-none absolute inset-y-2 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.35)]" />
          <div className="pointer-events-none absolute inset-x-2 top-1/2 h-[1.5px] -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.35)]" />
        </div>

        <div className="flex items-center justify-center">
          <span
            className={`inline-block origin-center rotate-90 whitespace-nowrap text-center ${labelClass}`}
          >
            {i18n(language, { en: "Lean", fr: "Sec" })}
          </span>
        </div>

        <div />
        <div className={`text-center ${labelClass}`}>
          {i18n(language, { en: "Plump", fr: "Plein" })}
        </div>
        <div />
      </div>
    </div>
  );
}

/**
 * Under the composition matrix: lowest numeric score across all facial body-fat metrics
 * (not tied to the 2×2 matrix axes).
 */
export function BodyfatWeakestScoreCallout({
  aggregates,
  language,
  compact = false,
}: {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
  compact?: boolean;
}) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const weakest = getBodyfatWeakestLeafScore(aggregates, locale);
  if (!weakest) return null;

  const paint = skinRadarAxisPaint("weak");
  const scoreTxt = weakest.score.toFixed(weakest.score % 1 === 0 ? 0 : 1);

  return (
    <div
      className={
        compact
          ? "mx-auto mt-3 w-full max-w-[14rem] text-center"
          : "mx-auto mt-5 w-full max-w-md text-center"
      }
    >
      <p
        className={
          compact
            ? "mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500"
            : "mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500"
        }
      >
        {i18n(language, {
          en: "Lowest score (facial body fat)",
          fr: "Score le plus faible — masse grasse faciale",
        })}
      </p>
      <div
        className={
          compact
            ? "rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2"
            : "rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3"
        }
      >
        <p
          className={
            compact
              ? "text-[11px] font-semibold tracking-wide"
              : "text-sm font-semibold tracking-wide"
          }
          style={{ color: paint.labelFill }}
        >
          {weakest.label}
        </p>
        <p
          className={
            compact
              ? "mt-0.5 font-display text-base font-bold tabular-nums"
              : "mt-1 font-display text-lg font-bold tabular-nums"
          }
          style={{ color: paint.previewScoreFill }}
        >
          {scoreTxt}
          <span
            className={
              compact
                ? "ml-0.5 text-[10px] font-semibold"
                : "ml-0.5 text-xs font-semibold"
            }
            style={{ color: paint.previewMutedFill }}
          >
            /10
          </span>
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Full matrix section (worker detail card)
 *
 * Les valeurs `leanness` / `sharpness` pilotent la grille et le quadrant, mais ne sont plus
 * affichées en chips /10 ici (doublon avec les barres du worker). Détail :
 * - Minceur → `body_fat_estimation.facial_leanness_score`
 * - Marqué → `getBodyfatCompositionSharpness` (moyenne mâchoire, pommettes, angularité)
 * ------------------------------------------------------------------------- */

export function CompositionMatrix({
  leanness,
  sharpness,
  language,
}: {
  leanness: number | null;
  sharpness: number | null;
  language: AppLanguage;
}) {
  const quadrant = compositionQuadrant(leanness, sharpness);

  const description = i18n(language, {
    en: "Two faces with the same leanness can read very differently depending on bone structure. The matrix combines both signals so you see the full picture.",
    fr: "Deux visages aussi secs peuvent rendre très différemment selon la structure osseuse. La matrice combine les deux signaux pour une lecture complète.",
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 sm:gap-8">
      <div className="space-y-2 text-center">
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
      </div>

      <BodyfatCompositionMatrixVisual
        leanness={leanness}
        sharpness={sharpness}
        language={language}
        compact={false}
      />

      <p className="mx-auto max-w-xl text-center text-sm leading-relaxed text-zinc-400">
        {description}
      </p>

      <ActiveCompositionQuadrant quadrant={quadrant} language={language} />
    </div>
  );
}
