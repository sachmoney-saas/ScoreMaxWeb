import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type FaceAnalysisLocale,
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import { calculateWorkerFaceScore } from "@/lib/face-analysis-score";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
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
import { AnalysisJobAssetPreviewThumb } from "./AnalysisJobAssetPreviewThumb";

const WORKER_KEY = "eyes";

/* ----------------------------------------------------------------------------
 * Iris : une entrée par valeur possible du modèle (15), ordre = mélanine / luminance
 * décroissante du haut vers le bas — `almost_black` est toujours le pôle le plus sombre.
 * Référence clés : AGGREGATE_VALUE_REGISTRY eyes → iris_sclera_and_lashes.iris_color
 * ------------------------------------------------------------------------- */

const IRIS_SPECTRUM: { key: string; color: string }[] = [
  { key: "light_blue", color: "#7cb1d6" },
  { key: "dark_blue", color: "#2a5080" },
  { key: "grey_blue", color: "#6b7d8f" },
  { key: "pure_grey", color: "#9da4ad" },
  { key: "light_green", color: "#8fbc8f" },
  { key: "dark_green", color: "#2d5a3a" },
  { key: "hazel_green", color: "#7a8f5c" },
  { key: "hazel_brown", color: "#8b6f47" },
  { key: "light_brown", color: "#a06f43" },
  { key: "medium_brown", color: "#6a4528" },
  { key: "amber", color: "#b8860b" },
  { key: "dark_brown", color: "#3a261a" },
  /* Hétérochromie : transitions encore assombries mais avant le presque noir */
  { key: "central_heterochromia", color: "#2e221b" },
  { key: "sectoral_heterochromia", color: "#231a13" },
  { key: "almost_black", color: "#1a1410" },
];

function normalizeIrisKey(value: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase().trim().replace(/\s+/g, "_");
}

/** Barre étroite et haute : chaque bande est plus haute que large (voir maquette). */
const IRIS_BAR_WIDTH_CLASS = "w-7 sm:w-8";
/** Piste de mesure : hauteur fixe (les % du repère sont relatifs à cette boîte uniquement). */
const IRIS_GRAPH_TRACK_CLASS = "h-[26rem] sm:h-[30rem]";

function isHeterochromiaKey(normalized: string | null): boolean {
  return (
    normalized === "central_heterochromia" || normalized === "sectoral_heterochromia"
  );
}

function irisMelaninSummary(
  language: AppLanguage,
  normalized: string | null,
  paletteIndex: number,
): React.ReactNode {
  const fr = language === "fr";
  if (isHeterochromiaKey(normalized)) {
    return fr ? (
      <>
        Ton iris présente une répartition pigmentaire{" "}
        <span className="font-semibold text-white">atypique</span> (hétérochromie).
      </>
    ) : (
      <>
        Your iris shows{" "}
        <span className="font-semibold text-white">atypical pigment</span> distribution
        (heterochromia).
      </>
    );
  }
  const idx = paletteIndex >= 0 ? paletteIndex : 0;
  if (idx < 4) {
    return fr ? (
      <>
        Tes yeux correspondent à une{" "}
        <span className="font-semibold text-white">faible mélanisation</span> de
        l&apos;iris (tons clairs, bleus-gris).
      </>
    ) : (
      <>
        Your eyes skew toward{" "}
        <span className="font-semibold text-white">low melanin</span> in the iris (lighter /
        cooler tones).
      </>
    );
  }
  if (idx < 8) {
    return fr ? (
      <>
        Tes yeux se situent dans une plage de{" "}
        <span className="font-semibold text-white">mélanine modérée</span> (verts et
        noisettes).
      </>
    ) : (
      <>
        Your eyes sit in a <span className="font-semibold text-white">moderate melanin</span> range
        (greens and hazels).
      </>
    );
  }
  if (idx < 10) {
    return fr ? (
      <>
        Les tons de tes yeux indiquent une{" "}
        <span className="font-semibold text-white">mélanine assez élevée</span> dans
        l&apos;iris (bruns clairs à moyens).
      </>
    ) : (
      <>
        Your eyes show{" "}
        <span className="font-semibold text-white">relatively high melanin</span> concentration in
        the iris.
      </>
    );
  }
  if (idx < 12) {
    return fr ? (
      <>
        Ton iris reflète une{" "}
        <span className="font-semibold text-white">forte concentration de mélanine</span> (ambre ou
        brun profond).
      </>
    ) : (
      <>
        Your eyes have{" "}
        <span className="font-semibold text-white">high melanin</span> concentration (amber to deep
        brown).
      </>
    );
  }
  /* Presque noir (index 14) ; hétérochromies 12–13 gérées plus haut */
  return fr ? (
    <>
      Ton iris est proche du pôle à{" "}
      <span className="font-semibold text-white">mélanisation maximale</span> (brun très foncé,
      presque noir).
    </>
  ) : (
    <>
      Your iris is near the{" "}
      <span className="font-semibold text-white">maximum melanin</span> pole (almost black-brown).
    </>
  );
}

/** Spectre vertical : du bleu clair (haut) aux tons très foncés (bas), avec repère utilisateur. */
function IrisSpectrumVertical({
  selected,
  valueLabel,
  argument,
  language,
}: {
  selected: string | null;
  valueLabel: string | null;
  argument: string | null;
  language: AppLanguage;
}) {
  const normalized = normalizeIrisKey(selected);
  const idx = normalized ? IRIS_SPECTRUM.findIndex((p) => p.key === normalized) : -1;
  const total = IRIS_SPECTRUM.length;
  const pctTop = idx >= 0 ? ((idx + 0.5) / total) * 100 : null;
  const swatchHex = idx >= 0 ? IRIS_SPECTRUM[idx]?.color ?? null : null;
  const displayLabel =
    valueLabel?.trim().length && idx >= 0 ? valueLabel.toUpperCase() : null;

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-md py-6 sm:py-8">
        <div
          className={cn(
            "relative mx-auto w-full max-w-xs select-none sm:max-w-sm",
            IRIS_GRAPH_TRACK_CLASS,
          )}
          aria-label={
            typeof valueLabel === "string" ? valueLabel : "Iris melanin spectrum"
          }
        >
          {/* Ligne horizontale centrée sur la bande sélectionnée (même référence de hauteur que la barre) */}
          {pctTop !== null ? (
            <div
              className="pointer-events-none absolute left-0 right-0 z-[1] border-t border-dashed border-white/30"
              style={{
                top: `${pctTop}%`,
                transform: "translateY(-50%)",
              }}
            />
          ) : null}

          <div
            className={cn(
              "absolute left-1/2 top-0 z-[2] flex h-full -translate-x-1/2 flex-col overflow-hidden rounded-full border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
              IRIS_BAR_WIDTH_CLASS,
            )}
          >
            {IRIS_SPECTRUM.map((p, i) => (
              <div
                key={p.key}
                className={cn(
                  "min-h-0 flex-1 transition-[box-shadow] duration-200",
                  i === idx ? "z-[1] ring-2 ring-inset ring-white/70" : "",
                )}
                style={{ backgroundColor: p.color }}
              />
            ))}
          </div>

          {pctTop !== null && displayLabel && swatchHex ? (
            <div
              className="absolute left-0 right-0 z-[3] grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 px-0 sm:gap-x-3 sm:px-2"
              style={{
                top: `${pctTop}%`,
                transform: "translateY(-50%)",
              }}
            >
              <div className="flex min-w-0 items-center justify-end gap-2 pr-1 sm:pr-2">
                <div
                  className="size-5 shrink-0 rounded border border-white/40 shadow-sm sm:size-6"
                  style={{ backgroundColor: swatchHex }}
                />
                <span className="max-w-[9rem] truncate text-right text-[10px] font-bold leading-tight text-zinc-100 sm:max-w-[11rem] sm:text-xs">
                  {displayLabel}
                </span>
              </div>
              <div className={cn("shrink-0", IRIS_BAR_WIDTH_CLASS)} aria-hidden />
              <div className="flex justify-start pl-1 sm:pl-2">
                <span className="rounded-full border border-white/25 bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-900 shadow-sm">
                  {i18n(language, { en: "You", fr: "Toi" })}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm leading-relaxed text-zinc-300 sm:px-5 sm:py-4">
        {idx >= 0 ? (
          irisMelaninSummary(language, normalized, idx)
        ) : language === "fr" ? (
          <>
            Repère lisible avec la valeur détectée :{" "}
            <span className="font-semibold text-white">{valueLabel ?? selected}</span>.
          </>
        ) : (
          <>
            Mapped to spectrum using detected value{" "}
            <span className="font-semibold text-white">{valueLabel ?? selected}</span>.
          </>
        )}
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

export interface EyesWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
  heroAside?: React.ReactNode;
  /** Repère scan gros plan œil (contours), comme la preview tableau de bord. */
  eyeCloseupContoursGuideSrc?: string | null;
  /** Repère canthal tilt (segment médial→latéral par œil). */
  eyeCloseupCanthalTiltGuideSrc?: string | null;
}

export function EyesWorkerView({
  aggregates,
  language,
  heroAside,
  eyeCloseupContoursGuideSrc,
  eyeCloseupCanthalTiltGuideSrc,
}: EyesWorkerViewProps) {
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

  const overall = getScore(aggregates, "global_score.overall_eye_score");

  const canthalEnum = getEnum(aggregates, "morphology_and_tilt.canthal_tilt");
  const eyeSpacing = getScore(aggregates, "morphology_and_tilt.eye_spacing");
  const orbitalDepth = getScore(aggregates, "morphology_and_tilt.orbital_depth");
  const eyeSym = getScore(aggregates, "morphology_and_tilt.eye_symmetry");

  // Eyelids & sclera
  const upperLid = getScore(aggregates, "eyelids_and_sclera.upper_eyelid_exposure");
  const lowerSclera = getScore(aggregates, "eyelids_and_sclera.lower_scleral_show");
  const epiEnum = getEnum(aggregates, "eyelids_and_sclera.epicanthic_fold");

  const support = getScore(aggregates, "under_eye_health.under_eye_support");
  const pigmentation = getScore(aggregates, "under_eye_health.under_eye_pigmentation");

  const sclera = getScore(aggregates, "iris_sclera_and_lashes.sclera_clarity");
  const limbalEnum = getEnum(
    aggregates,
    "iris_sclera_and_lashes.limbal_ring_visibility",
  );
  const lashes = getScore(aggregates, "iris_sclera_and_lashes.eyelash_density");
  const irisEnum = getEnum(aggregates, "iris_sclera_and_lashes.iris_color");

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Eyes",
          fr: "Yeux",
        })}
        title={i18n(language, {
          en: "Your eye signature",
          fr: "Ta signature oculaire",
        })}
        argument={overall.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={mergeHeroRightSlot(undefined, heroAside)}
      />

      {/* Iris swatch */}
      {irisEnum.value ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Iris color", fr: "Couleur de l'iris" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Where your iris falls",
                  fr: "Où se situe ton iris",
                })}
              </h3>
            </div>
            {eyeCloseupContoursGuideSrc || eyeCloseupCanthalTiltGuideSrc ? (
              <div className="flex w-full shrink-0 flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
                {eyeCloseupContoursGuideSrc ? (
                  <AnalysisJobAssetPreviewThumb
                    src={eyeCloseupContoursGuideSrc}
                    alt={i18n(language, {
                      en: "Eye close-up scan overlay: contour guide trace",
                      fr: "Repère gros plan œil — contours",
                    })}
                    imgFit="contain"
                    className="w-fit max-w-[min(100%,22rem)] shrink-0"
                    imgClassName="max-h-[13rem] sm:max-h-[15rem]"
                  />
                ) : null}
                {eyeCloseupCanthalTiltGuideSrc ? (
                  <AnalysisJobAssetPreviewThumb
                    src={eyeCloseupCanthalTiltGuideSrc}
                    alt={i18n(language, {
                      en: "Eye close-up: canthal tilt guide (medial→lateral per eye)",
                      fr: "Repère gros plan œil — canthal tilt",
                    })}
                    imgFit="contain"
                    className="w-fit max-w-[min(100%,22rem)] shrink-0"
                    imgClassName="max-h-[13rem] sm:max-h-[15rem]"
                  />
                ) : null}
              </div>
            ) : null}
            <IrisSpectrumVertical
              selected={irisEnum.value}
              valueLabel={formatEnumValue(
                "iris_sclera_and_lashes.iris_color",
                irisEnum.value,
              )}
              argument={irisEnum.argument}
              language={language}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          when={
            Boolean(canthalEnum.value) ||
            hasAnyScore(eyeSpacing.score, orbitalDepth.score, eyeSym.score)
          }
          eyebrow={i18n(language, {
            en: "Morphology & tilt",
            fr: "Morphologie et inclinaison",
          })}
          title={i18n(language, {
            en: "Spacing, depth & symmetry",
            fr: "Espacement, profondeur et symétrie",
          })}
        >
          {canthalEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("morphology_and_tilt.canthal_tilt")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "morphology_and_tilt.canthal_tilt",
                    canthalEnum.value,
                  )}
                </span>
              </div>
              {canthalEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {canthalEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
          <ScoreBar
            label={formatLabel("morphology_and_tilt.eye_spacing")}
            score={eyeSpacing.score}
            argument={eyeSpacing.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("morphology_and_tilt.orbital_depth")}
            score={orbitalDepth.score}
            argument={orbitalDepth.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("morphology_and_tilt.eye_symmetry")}
            score={eyeSym.score}
            argument={eyeSym.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          when={
            hasAnyScore(upperLid.score, lowerSclera.score) ||
            Boolean(epiEnum.value)
          }
          eyebrow={i18n(language, {
            en: "Eyelids & sclera",
            fr: "Paupières et sclère",
          })}
          title={i18n(language, {
            en: "Lid exposure & whites",
            fr: "Paupières et blanc",
          })}
        >
          <ScoreBar
            label={formatLabel("eyelids_and_sclera.upper_eyelid_exposure")}
            score={upperLid.score}
            argument={upperLid.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("eyelids_and_sclera.lower_scleral_show")}
            score={lowerSclera.score}
            argument={lowerSclera.argument}
            language={language}
          />
          {epiEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("eyelids_and_sclera.epicanthic_fold")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "eyelids_and_sclera.epicanthic_fold",
                    epiEnum.value,
                  )}
                </span>
              </div>
              {epiEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {epiEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>

        <SectionShell
          when={hasAnyScore(support.score, pigmentation.score)}
          eyebrow={i18n(language, {
            en: "Under-eye health",
            fr: "Santé sous les yeux",
          })}
          title={i18n(language, {
            en: "Support & pigmentation",
            fr: "Support et pigmentation",
          })}
        >
          <ScoreBar
            label={formatLabel("under_eye_health.under_eye_support")}
            score={support.score}
            argument={support.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("under_eye_health.under_eye_pigmentation")}
            score={pigmentation.score}
            argument={pigmentation.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          when={
            hasAnyScore(sclera.score, lashes.score) || Boolean(limbalEnum.value)
          }
          eyebrow={i18n(language, {
            en: "Iris, sclera & lashes",
            fr: "Iris, sclère et cils",
          })}
          title={i18n(language, {
            en: "Clarity, ring & lashes",
            fr: "Clarté, anneau et cils",
          })}
        >
          <ScoreBar
            label={formatLabel("iris_sclera_and_lashes.sclera_clarity")}
            score={sclera.score}
            argument={sclera.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("iris_sclera_and_lashes.eyelash_density")}
            score={lashes.score}
            argument={lashes.argument}
            language={language}
          />
          {limbalEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("iris_sclera_and_lashes.limbal_ring_visibility")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue(
                    "iris_sclera_and_lashes.limbal_ring_visibility",
                    limbalEnum.value,
                  )}
                </span>
              </div>
              {limbalEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {limbalEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>
      </div>
    </div>
  );
}
