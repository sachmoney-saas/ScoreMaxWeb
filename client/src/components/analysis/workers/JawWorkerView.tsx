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

const WORKER_KEY = "jaw";

/* ----------------------------------------------------------------------------
 * Frontal jaw shape gallery
 *
 * Six canonical morphologies. Each is a small SVG focused on the lower face
 * (jawline + chin), so the user instantly recognises the difference between
 * tapered, square, round, oval, heart and wide.
 * ------------------------------------------------------------------------- */

type FrontalShape =
  | "tapered"
  | "square"
  | "round"
  | "oval"
  | "heart"
  | "wide";

const FRONTAL_SHAPES: {
  key: FrontalShape;
  label: { en: string; fr: string };
  /** Path for a 100x80 box, anchored at top (cheek line) → chin. */
  d: string;
}[] = [
  {
    key: "tapered",
    label: { en: "Tapered", fr: "Effilée" },
    d: "M10 4 C18 30 36 64 50 76 C64 64 82 30 90 4",
  },
  {
    key: "square",
    label: { en: "Square", fr: "Carrée" },
    d: "M10 4 C12 38 16 60 26 70 L74 70 C84 60 88 38 90 4",
  },
  {
    key: "round",
    label: { en: "Round", fr: "Ronde" },
    d: "M10 4 C12 36 22 70 50 74 C78 70 88 36 90 4",
  },
  {
    key: "oval",
    label: { en: "Oval", fr: "Ovale" },
    d: "M10 4 C16 38 28 68 50 74 C72 68 84 38 90 4",
  },
  {
    key: "heart",
    label: { en: "Heart", fr: "Cœur" },
    d: "M10 4 C18 28 36 60 50 76 C64 60 82 28 90 4",
  },
  {
    key: "wide",
    label: { en: "Wide", fr: "Large" },
    d: "M6 4 C6 38 12 64 24 72 L76 72 C88 64 94 38 94 4",
  },
];

const FRONTAL_ALIASES: Record<string, FrontalShape> = {
  tapered: "tapered",
  effilée: "tapered",
  effilee: "tapered",
  pointed: "tapered",
  triangular: "tapered",
  square: "square",
  squared: "square",
  carrée: "square",
  carree: "square",
  round: "round",
  rounded: "round",
  ronde: "round",
  oval: "oval",
  ovale: "oval",
  oblong: "oval",
  heart: "heart",
  cœur: "heart",
  coeur: "heart",
  wide: "wide",
  rectangular: "wide",
  large: "wide",
  rectangle: "wide",
};

function normalizeFrontal(value: string | null): FrontalShape | null {
  if (!value) return null;
  const k = value.toLowerCase().trim();
  return FRONTAL_ALIASES[k] ?? null;
}

function FrontalGallery({
  selected,
  language,
}: {
  selected: FrontalShape | null;
  language: AppLanguage;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {FRONTAL_SHAPES.map((shape) => {
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
            <svg
              viewBox="0 0 100 80"
              className="h-14 w-16 sm:h-16 sm:w-20"
              role="img"
              aria-label={shape.label.en}
            >
              <path
                d={shape.d}
                fill="none"
                stroke={
                  isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.28)"
                }
                strokeWidth={isActive ? 2.4 : 1.6}
                strokeLinecap="round"
              />
              <path
                d={`${shape.d} L10 4 Z`}
                fill={isActive ? "rgba(233,241,244,0.16)" : "rgba(154,174,181,0.08)"}
                stroke="none"
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
 * Side jaw shape gallery
 *
 * Profile silhouettes of the lower face — outlining the gonion → chin
 * trajectory: sloped (recessed), straight, jutted (forward), recessed.
 * ------------------------------------------------------------------------- */

type SideShape = "sloped" | "straight" | "jutted" | "recessed";

const SIDE_SHAPES: {
  key: SideShape;
  label: { en: string; fr: string };
  /** Profile path 100x100, jaw goes from top-right (ear/gonion) to chin (left). */
  d: string;
}[] = [
  {
    key: "sloped",
    label: { en: "Sloped", fr: "Inclinée" },
    d: "M88 14 C84 28 70 50 50 64 C36 72 26 78 18 84",
  },
  {
    key: "straight",
    label: { en: "Straight", fr: "Droite" },
    d: "M88 14 C82 30 64 56 40 76 L18 84",
  },
  {
    key: "jutted",
    label: { en: "Jutted", fr: "Avancée" },
    d: "M88 14 C76 36 56 56 32 70 C22 74 14 76 8 76",
  },
  {
    key: "recessed",
    label: { en: "Recessed", fr: "Retirée" },
    d: "M88 14 C86 32 78 54 60 70 C46 80 34 86 28 90",
  },
];

const SIDE_ALIASES: Record<string, SideShape> = {
  sloped: "sloped",
  slope: "sloped",
  inclined: "sloped",
  inclinée: "sloped",
  inclinee: "sloped",
  oblique: "sloped",
  straight: "straight",
  droite: "straight",
  square: "straight",
  jutted: "jutted",
  forward: "jutted",
  projected: "jutted",
  avancée: "jutted",
  avancee: "jutted",
  prognathic: "jutted",
  recessed: "recessed",
  weak: "recessed",
  retirée: "recessed",
  retiree: "recessed",
  retracted: "recessed",
};

function normalizeSide(value: string | null): SideShape | null {
  if (!value) return null;
  const k = value.toLowerCase().trim();
  return SIDE_ALIASES[k] ?? null;
}

function SideGallery({
  selected,
  language,
}: {
  selected: SideShape | null;
  language: AppLanguage;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SIDE_SHAPES.map((shape) => {
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
            <svg
              viewBox="0 0 100 100"
              className="h-16 w-20"
              role="img"
              aria-label={shape.label.en}
            >
              {/* Reference ear dot */}
              <circle
                cx={88}
                cy={14}
                r={2.5}
                fill="rgba(255,255,255,0.4)"
              />
              <path
                d={shape.d}
                fill="none"
                stroke={
                  isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.28)"
                }
                strokeWidth={isActive ? 2.6 : 1.8}
                strokeLinecap="round"
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
 * Definition meter — "soft → bony" axis specific to jawline definition.
 * ------------------------------------------------------------------------- */

function DefinitionMeter({
  definition,
  contrast,
  language,
}: {
  definition: number | null;
  contrast: number | null;
  language: AppLanguage;
}) {
  const segments = [
    { key: "soft", color: "#3a4a52", label: { en: "Soft", fr: "Doux" } },
    { key: "smooth", color: "#536974", label: { en: "Smooth", fr: "Lisse" } },
    {
      key: "moderate",
      color: "#788d96",
      label: { en: "Moderate", fr: "Modérée" },
    },
    { key: "defined", color: "#9fb4bb", label: { en: "Defined", fr: "Définie" } },
    { key: "sharp", color: "#c5d6db", label: { en: "Sharp", fr: "Marquée" } },
    {
      key: "chiseled",
      color: "#e9f1f4",
      label: { en: "Chiseled", fr: "Ciselée" },
    },
  ];

  const idxFromScore = (s: number | null) =>
    s === null
      ? null
      : Math.min(
          segments.length - 1,
          Math.max(0, Math.round((s / 10) * (segments.length - 1))),
        );

  const defIdx = idxFromScore(definition);
  const conIdx = idxFromScore(contrast);

  const markerPct = (idx: number | null) =>
    idx === null ? null : ((idx + 0.5) / segments.length) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">
          {i18n(language, {
            en: "Jawline definition spectrum",
            fr: "Spectre de définition mandibulaire",
          })}
        </span>
        <span className="text-xs font-medium text-zinc-400">
          {i18n(language, {
            en: "Definition × Contrast w/ neck",
            fr: "Définition × Contraste cou",
          })}
        </span>
      </div>

      <div className="relative">
        <div className="relative h-12 w-full overflow-hidden rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex h-full w-full">
            {segments.map((s) => (
              <div
                key={s.key}
                className="h-full flex-1"
                style={{ backgroundColor: s.color }}
              />
            ))}
          </div>
          {segments.slice(1).map((_, i) => (
            <div
              key={`div-${i}`}
              className="absolute inset-y-0 w-px bg-black/20"
              style={{ left: `${((i + 1) / segments.length) * 100}%` }}
            />
          ))}

          {/* definition marker (filled) */}
          {markerPct(defIdx) !== null ? (
            <div
              className="pointer-events-none absolute top-1 flex -translate-x-1/2 flex-col items-center gap-0.5"
              style={{ left: `${markerPct(defIdx)}%` }}
            >
              <span className="rounded-full bg-zinc-950/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-white ring-1 ring-white/30">
                {i18n(language, { en: "Def", fr: "Déf" })}
              </span>
              <div className="h-7 w-[3px] rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]" />
            </div>
          ) : null}

          {/* contrast marker (outlined) */}
          {markerPct(conIdx) !== null ? (
            <div
              className="pointer-events-none absolute bottom-1 flex -translate-x-1/2 flex-col items-center gap-0.5"
              style={{ left: `${markerPct(conIdx)}%` }}
            >
              <div className="h-7 w-[3px] rounded-full bg-cyan-200 shadow-[0_0_0_2px_rgba(0,0,0,0.55)]" />
              <span className="rounded-full bg-zinc-950/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-cyan-200 ring-1 ring-cyan-200/40">
                {i18n(language, { en: "Neck", fr: "Cou" })}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-2 grid grid-cols-6 gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {segments.map((s, i) => (
            <span
              key={s.key}
              className={`text-center ${i === defIdx ? "text-white" : ""}`}
            >
              {i18n(language, s.label)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface JawWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function JawWorkerView({ aggregates, language }: JawWorkerViewProps) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const formatLabel = React.useCallback(
    (key: string) => formatAggregateDisplayLabel(WORKER_KEY, key, locale),
    [locale],
  );

  // Global
  const overall = getScore(aggregates, "overall_jaw");

  // Frontal
  const frontalEnum = getEnum(aggregates, "frontal_geometry.jaw_shape_frontal");
  const frontalKey = normalizeFrontal(frontalEnum.value);
  const frontalDisplay = frontalEnum.value
    ? formatAggregateDisplayValue(
        WORKER_KEY,
        "frontal_geometry.jaw_shape_frontal",
        frontalEnum.value,
        locale,
      )
    : null;
  const jawWidth = getScore(aggregates, "frontal_geometry.jaw_width");
  const jawCheek = getScore(aggregates, "frontal_geometry.jaw_to_cheek_ratio");
  const jawFace = getScore(aggregates, "frontal_geometry.jaw_to_face_proportion");

  // Side
  const sideEnum = getEnum(aggregates, "profile_architecture.jaw_shape_side");
  const sideKey = normalizeSide(sideEnum.value);
  const sideDisplay = sideEnum.value
    ? formatAggregateDisplayValue(
        WORKER_KEY,
        "profile_architecture.jaw_shape_side",
        sideEnum.value,
        locale,
      )
    : null;
  const ramus = getScore(aggregates, "profile_architecture.jaw_height_ramus");
  const length = getScore(aggregates, "profile_architecture.jawline_length");

  // Definition / contrast
  const definition = getScore(
    aggregates,
    "definition_and_contrast.jawline_definition",
  );
  const contrastNeck = getScore(
    aggregates,
    "definition_and_contrast.jawline_contrast_neck",
  );

  // Symmetry
  const symmetry = getScore(aggregates, "symmetry_and_flare.jaw_symmetry");
  const flare = getScore(aggregates, "symmetry_and_flare.jaw_flare_symmetry");

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, {
          en: "Jaw architecture",
          fr: "Architecture mandibulaire",
        })}
        title={i18n(language, {
          en: "Your jawline",
          fr: "Ta ligne mandibulaire",
        })}
        argument={overall.argument}
        score={overall.score}
        rightSlot={
          frontalDisplay || sideDisplay ? (
            <div className="flex flex-col gap-2">
              {frontalDisplay ? (
                <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    {i18n(language, { en: "Frontal", fr: "Frontale" })}
                  </p>
                  <p className="mt-0.5 font-display text-base font-bold text-white">
                    {frontalDisplay}
                  </p>
                </div>
              ) : null}
              {sideDisplay ? (
                <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    {i18n(language, { en: "Profile", fr: "Profil" })}
                  </p>
                  <p className="mt-0.5 font-display text-base font-bold text-white">
                    {sideDisplay}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null
        }
      />

      {/* Frontal shape gallery */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, {
                en: "Frontal taxonomy",
                fr: "Taxonomie frontale",
              })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Front-view jaw shape",
                fr: "Forme frontale de la mâchoire",
              })}
            </h3>
            {frontalEnum.argument ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                {frontalEnum.argument}
              </p>
            ) : null}
          </div>
          <FrontalGallery selected={frontalKey} language={language} />
        </CardContent>
      </Card>

      {/* Side shape gallery */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, {
                en: "Profile taxonomy",
                fr: "Taxonomie de profil",
              })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Side-view jaw shape",
                fr: "Forme de profil de la mâchoire",
              })}
            </h3>
            {sideEnum.argument ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                {sideEnum.argument}
              </p>
            ) : null}
          </div>
          <SideGallery selected={sideKey} language={language} />
        </CardContent>
      </Card>

      {/* Definition spectrum */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, {
                  en: "Definition",
                  fr: "Définition",
                })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Bone-line clarity",
                  fr: "Lisibilité de la ligne osseuse",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "How sharply your mandibular border reads on screen, and how cleanly it separates from the neck.",
                  fr: "À quel point ton bord mandibulaire ressort visuellement, et à quel point il se sépare nettement du cou.",
                })}
              </p>
            </div>
            <DefinitionMeter
              definition={definition.score}
              contrast={contrastNeck.score}
              language={language}
            />
          </div>
        </CardContent>
      </Card>

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Frontal geometry",
            fr: "Géométrie frontale",
          })}
          title={i18n(language, {
            en: "Width & ratios",
            fr: "Largeur et ratios",
          })}
        >
          <ScoreBar
            label={formatLabel("frontal_geometry.jaw_width")}
            score={jawWidth.score}
            argument={jawWidth.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("frontal_geometry.jaw_to_cheek_ratio")}
            score={jawCheek.score}
            argument={jawCheek.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("frontal_geometry.jaw_to_face_proportion")}
            score={jawFace.score}
            argument={jawFace.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Profile architecture",
            fr: "Architecture de profil",
          })}
          title={i18n(language, {
            en: "Ramus & length",
            fr: "Ramus et longueur",
          })}
        >
          <ScoreBar
            label={formatLabel("profile_architecture.jaw_height_ramus")}
            score={ramus.score}
            argument={ramus.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("profile_architecture.jawline_length")}
            score={length.score}
            argument={length.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Definition & contrast",
            fr: "Définition et contraste",
          })}
          title={i18n(language, {
            en: "Edge & shadow",
            fr: "Arête et ombre",
          })}
        >
          <ScoreBar
            label={formatLabel("definition_and_contrast.jawline_definition")}
            score={definition.score}
            argument={definition.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("definition_and_contrast.jawline_contrast_neck")}
            score={contrastNeck.score}
            argument={contrastNeck.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Symmetry",
            fr: "Symétrie",
          })}
          title={i18n(language, {
            en: "Left vs right balance",
            fr: "Équilibre gauche / droite",
          })}
        >
          <ScoreBar
            label={formatLabel("symmetry_and_flare.jaw_symmetry")}
            score={symmetry.score}
            argument={symmetry.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("symmetry_and_flare.jaw_flare_symmetry")}
            score={flare.score}
            argument={flare.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
