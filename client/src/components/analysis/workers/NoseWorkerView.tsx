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

const WORKER_KEY = "nose";

/* ----------------------------------------------------------------------------
 * Bridge profile gallery
 *
 * Each card shows the dorsum profile from forehead → nose tip on a 100x80
 * canvas. The path goes top (forehead/nasofrontal) → bottom (tip).
 * ------------------------------------------------------------------------- */

type BridgeShape =
  | "straight"
  | "roman"
  | "hooked"
  | "snub"
  | "scooped"
  | "wavy";

const BRIDGE_SHAPES: {
  key: BridgeShape;
  label: { en: string; fr: string };
  d: string;
}[] = [
  {
    key: "straight",
    label: { en: "Straight", fr: "Droit" },
    d: "M10 6 L18 14 L42 50 L46 70 L40 76",
  },
  {
    key: "roman",
    label: { en: "Roman", fr: "Romain" },
    d: "M10 6 L18 14 Q26 22 38 38 Q50 50 46 70 L40 76",
  },
  {
    key: "hooked",
    label: { en: "Hooked", fr: "Crochu" },
    d: "M10 6 L18 14 Q28 18 42 36 Q56 56 32 70 L26 76",
  },
  {
    key: "snub",
    label: { en: "Snub", fr: "Retroussé" },
    d: "M10 6 L18 14 L36 44 Q40 60 50 64 Q56 70 50 78",
  },
  {
    key: "scooped",
    label: { en: "Scooped", fr: "Concave" },
    d: "M10 6 L18 14 Q34 36 30 50 Q34 64 50 70 L46 78",
  },
  {
    key: "wavy",
    label: { en: "Wavy", fr: "Ondulé" },
    d: "M10 6 L18 14 Q30 24 28 36 Q42 50 38 60 Q42 70 46 76",
  },
];

const BRIDGE_ALIASES: Record<string, BridgeShape> = {
  straight: "straight",
  droit: "straight",
  linear: "straight",
  roman: "roman",
  aquiline: "roman",
  romain: "roman",
  arched: "roman",
  hooked: "hooked",
  crochu: "hooked",
  hawk: "hooked",
  snub: "snub",
  upturned: "snub",
  retroussé: "snub",
  retrousse: "snub",
  scooped: "scooped",
  concave: "scooped",
  scoop: "scooped",
  wavy: "wavy",
  ondulé: "wavy",
  ondule: "wavy",
};

function normalizeBridge(value: string | null): BridgeShape | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return BRIDGE_ALIASES[k] ?? null;
}

function BridgeGallery({
  selected,
  language,
}: {
  selected: BridgeShape | null;
  language: AppLanguage;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {BRIDGE_SHAPES.map((shape) => {
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
              viewBox="0 0 80 88"
              className="h-16 w-12"
              role="img"
              aria-label={shape.label.en}
            >
              {/* Reference forehead/lip dots */}
              <circle cx={10} cy={6} r={2} fill="rgba(255,255,255,0.25)" />
              <circle cx={36} cy={84} r={2} fill="rgba(255,255,255,0.25)" />
              <path
                d={shape.d}
                fill="none"
                stroke={
                  isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.32)"
                }
                strokeWidth={isActive ? 2.4 : 1.8}
                strokeLinecap="round"
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
 * Nostril gallery (bottom view)
 * ------------------------------------------------------------------------- */

type NostrilShape = "round" | "oval" | "almond" | "narrow" | "flared";

const NOSTRIL_SHAPES: {
  key: NostrilShape;
  label: { en: string; fr: string };
  draw: (active: boolean) => React.ReactNode;
}[] = [
  {
    key: "round",
    label: { en: "Round", fr: "Rondes" },
    draw: (active) => (
      <>
        <ellipse cx={32} cy={28} rx={9} ry={9} fill={active ? "#0e1418" : "#1a2228"} />
        <ellipse cx={68} cy={28} rx={9} ry={9} fill={active ? "#0e1418" : "#1a2228"} />
      </>
    ),
  },
  {
    key: "oval",
    label: { en: "Oval", fr: "Ovales" },
    draw: (active) => (
      <>
        <ellipse cx={32} cy={28} rx={7} ry={11} fill={active ? "#0e1418" : "#1a2228"} />
        <ellipse cx={68} cy={28} rx={7} ry={11} fill={active ? "#0e1418" : "#1a2228"} />
      </>
    ),
  },
  {
    key: "almond",
    label: { en: "Almond", fr: "Amande" },
    draw: (active) => (
      <>
        <path
          d="M22 28 Q32 14 42 28 Q32 38 22 28 Z"
          fill={active ? "#0e1418" : "#1a2228"}
        />
        <path
          d="M58 28 Q68 14 78 28 Q68 38 58 28 Z"
          fill={active ? "#0e1418" : "#1a2228"}
        />
      </>
    ),
  },
  {
    key: "narrow",
    label: { en: "Narrow", fr: "Étroites" },
    draw: (active) => (
      <>
        <ellipse cx={36} cy={28} rx={4} ry={11} fill={active ? "#0e1418" : "#1a2228"} />
        <ellipse cx={64} cy={28} rx={4} ry={11} fill={active ? "#0e1418" : "#1a2228"} />
      </>
    ),
  },
  {
    key: "flared",
    label: { en: "Flared", fr: "Évasées" },
    draw: (active) => (
      <>
        <ellipse cx={26} cy={28} rx={11} ry={8} fill={active ? "#0e1418" : "#1a2228"} />
        <ellipse cx={74} cy={28} rx={11} ry={8} fill={active ? "#0e1418" : "#1a2228"} />
      </>
    ),
  },
];

const NOSTRIL_ALIASES: Record<string, NostrilShape> = {
  round: "round",
  rondes: "round",
  rond: "round",
  oval: "oval",
  ovales: "oval",
  almond: "almond",
  amande: "almond",
  teardrop: "almond",
  narrow: "narrow",
  étroites: "narrow",
  etroites: "narrow",
  thin: "narrow",
  flared: "flared",
  wide: "flared",
  évasées: "flared",
  evasees: "flared",
};

function normalizeNostril(value: string | null): NostrilShape | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return NOSTRIL_ALIASES[k] ?? null;
}

function NostrilGallery({
  selected,
  language,
}: {
  selected: NostrilShape | null;
  language: AppLanguage;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {NOSTRIL_SHAPES.map((shape) => {
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
              viewBox="0 0 100 56"
              className="h-12 w-24"
              role="img"
              aria-label={shape.label.en}
            >
              {/* nose base */}
              <path
                d="M10 44 Q50 16 90 44 Q70 50 50 50 Q30 50 10 44 Z"
                fill="rgba(154,174,181,0.18)"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={0.8}
              />
              {shape.draw(isActive)}
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
 * Main view
 * ------------------------------------------------------------------------- */

export interface NoseWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function NoseWorkerView({ aggregates, language }: NoseWorkerViewProps) {
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

  const overall = getScore(aggregates, "overall_nose");

  // Frontal
  const symmetry = getScore(aggregates, "frontal_symmetry_and_width.nose_symmetry");
  const alarWidth = getScore(
    aggregates,
    "frontal_symmetry_and_width.overall_alar_width",
  );
  const bridgeWidth = getScore(
    aggregates,
    "frontal_symmetry_and_width.bridge_width",
  );

  // Profile
  const bridgeEnum = getEnum(aggregates, "profile_dorsum_and_angles.bridge_shape");
  const bridgeKey = normalizeBridge(bridgeEnum.value);
  const bridgeDisplay = formatEnumValue(
    "profile_dorsum_and_angles.bridge_shape",
    bridgeEnum.value,
  );
  const supratip = getScore(aggregates, "profile_dorsum_and_angles.supratip_break");
  const nasofrontal = getScore(
    aggregates,
    "profile_dorsum_and_angles.nasofrontal_angle",
  );
  const nasolabial = getScore(
    aggregates,
    "profile_dorsum_and_angles.nasolabial_angle_rotation",
  );

  // Tip
  const tipDef = getScore(aggregates, "tip_morphology_and_projection.tip_definition");
  const tipProj = getScore(aggregates, "tip_morphology_and_projection.tip_projection");

  // Base
  const nostrilEnum = getEnum(aggregates, "base_and_nostrils.nostril_shape");
  const nostrilKey = normalizeNostril(nostrilEnum.value);
  const columella = getScore(aggregates, "base_and_nostrils.columella_alignment");
  const noseLength = getScore(aggregates, "base_and_nostrils.nose_length");

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Nose architecture", fr: "Architecture du nez" })}
        title={i18n(language, {
          en: "Your nasal signature",
          fr: "Ta signature nasale",
        })}
        argument={overall.argument}
        score={overall.score}
        rightSlot={
          bridgeDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Bridge", fr: "Arête" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {bridgeDisplay}
              </p>
            </div>
          ) : null
        }
      />

      {/* Bridge gallery */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, {
                en: "Bridge profile",
                fr: "Profil de l'arête",
              })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Side-view dorsum shape",
                fr: "Forme de l'arête de profil",
              })}
            </h3>
            {bridgeEnum.argument ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                {bridgeEnum.argument}
              </p>
            ) : null}
          </div>
          <BridgeGallery selected={bridgeKey} language={language} />
        </CardContent>
      </Card>

      {/* Nostrils gallery */}
      {nostrilEnum.value ? (
        <Card className={workerSectionCardClassName}>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, {
                  en: "Base view",
                  fr: "Vue de la base",
                })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Nostril shape",
                  fr: "Forme des narines",
                })}
              </h3>
              {nostrilEnum.argument ? (
                <p className="text-sm leading-relaxed text-zinc-400">
                  {nostrilEnum.argument}
                </p>
              ) : null}
            </div>
            <NostrilGallery selected={nostrilKey} language={language} />
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, {
            en: "Frontal width",
            fr: "Largeur frontale",
          })}
          title={i18n(language, {
            en: "Bridge & alar width",
            fr: "Arête et ailes",
          })}
        >
          <ScoreBar
            label={formatLabel("frontal_symmetry_and_width.bridge_width")}
            score={bridgeWidth.score}
            argument={bridgeWidth.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("frontal_symmetry_and_width.overall_alar_width")}
            score={alarWidth.score}
            argument={alarWidth.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("frontal_symmetry_and_width.nose_symmetry")}
            score={symmetry.score}
            argument={symmetry.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Profile angles",
            fr: "Angles de profil",
          })}
          title={i18n(language, {
            en: "Nasofrontal & nasolabial",
            fr: "Nasofrontal et nasolabial",
          })}
        >
          <ScoreBar
            label={formatLabel("profile_dorsum_and_angles.nasofrontal_angle")}
            score={nasofrontal.score}
            argument={nasofrontal.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("profile_dorsum_and_angles.nasolabial_angle_rotation")}
            score={nasolabial.score}
            argument={nasolabial.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("profile_dorsum_and_angles.supratip_break")}
            score={supratip.score}
            argument={supratip.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Tip morphology",
            fr: "Morphologie de la pointe",
          })}
          title={i18n(language, {
            en: "Definition & projection",
            fr: "Définition et projection",
          })}
        >
          <ScoreBar
            label={formatLabel("tip_morphology_and_projection.tip_definition")}
            score={tipDef.score}
            argument={tipDef.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("tip_morphology_and_projection.tip_projection")}
            score={tipProj.score}
            argument={tipProj.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, {
            en: "Base & length",
            fr: "Base et longueur",
          })}
          title={i18n(language, {
            en: "Columella & length",
            fr: "Columelle et longueur",
          })}
        >
          <ScoreBar
            label={formatLabel("base_and_nostrils.columella_alignment")}
            score={columella.score}
            argument={columella.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("base_and_nostrils.nose_length")}
            score={noseLength.score}
            argument={noseLength.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
