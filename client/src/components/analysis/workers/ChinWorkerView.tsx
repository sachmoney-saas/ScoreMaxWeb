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
  getEnum,
  getScore,
  ScoreBar,
  SectionShell,
  WorkerHero,
  workerSectionCardClassName,
} from "./_shared";

const WORKER_KEY = "chin";

/* ----------------------------------------------------------------------------
 * Chin shape gallery
 * ------------------------------------------------------------------------- */

type ChinShape = "round" | "pointed" | "square" | "cleft" | "oval";

const CHIN_SHAPES: {
  key: ChinShape;
  label: { en: string; fr: string };
  draw: (active: boolean) => React.ReactNode;
}[] = [
  {
    key: "round",
    label: { en: "Round", fr: "Rond" },
    draw: (active) => (
      <path
        d="M14 6 Q40 22 50 64 Q60 22 86 6"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ),
  },
  {
    key: "pointed",
    label: { en: "Pointed", fr: "Pointu" },
    draw: (active) => (
      <path
        d="M10 6 Q44 18 50 70 Q56 18 90 6"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ),
  },
  {
    key: "square",
    label: { en: "Square", fr: "Carré" },
    draw: (active) => (
      <path
        d="M14 6 Q26 26 30 56 L70 56 Q74 26 86 6"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ),
  },
  {
    key: "cleft",
    label: { en: "Cleft", fr: "Fossette" },
    draw: (active) => (
      <>
        <path
          d="M14 6 Q40 22 50 64 Q60 22 86 6"
          fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
          stroke={
            active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
          }
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <path
          d="M50 36 Q48 50 50 60 Q52 50 50 36 Z"
          fill="rgba(0,0,0,0.32)"
        />
      </>
    ),
  },
  {
    key: "oval",
    label: { en: "Oval", fr: "Ovale" },
    draw: (active) => (
      <path
        d="M12 6 Q42 20 50 60 Q58 20 88 6"
        fill={active ? "rgba(233,241,244,0.95)" : "rgba(154,174,181,0.45)"}
        stroke={
          active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)"
        }
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ),
  },
];

const CHIN_ALIASES: Record<string, ChinShape> = {
  round: "round",
  rounded: "round",
  rond: "round",
  pointed: "pointed",
  pointu: "pointed",
  v_shape: "pointed",
  "v-shape": "pointed",
  square: "square",
  squared: "square",
  carré: "square",
  carre: "square",
  cleft: "cleft",
  dimple: "cleft",
  fossette: "cleft",
  oval: "oval",
  ovale: "oval",
};

function normalizeChin(value: string | null): ChinShape | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return CHIN_ALIASES[k] ?? null;
}

function ChinShapeGallery({
  selected,
  language,
}: {
  selected: ChinShape | null;
  language: AppLanguage;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {CHIN_SHAPES.map((shape) => {
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
              className="h-16 w-20"
              role="img"
              aria-label={shape.label.en}
            >
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
 * Profile projection diagram
 *
 * Shows the lower-face profile with a projection arrow that slides forward as
 * chin_projection score grows. Visualises Riedel's plane visually.
 * ------------------------------------------------------------------------- */

function ChinProjectionDiagram({
  projection,
  inclination,
  height,
  language,
}: {
  projection: number | null;
  inclination: number | null;
  height: number | null;
  language: AppLanguage;
}) {
  const p = projection !== null ? Math.max(0, Math.min(10, projection)) : 5;
  const i = inclination !== null ? Math.max(0, Math.min(10, inclination)) : 5;
  const h = height !== null ? Math.max(0, Math.min(10, height)) : 5;

  // Reference line (lip→nose tip) at x=70. Chin tip x = 50 + (p-5)*4 -> 30..70
  const chinTipX = 56 + (p - 5) * 4;
  const chinTipY = 110 + (h - 5) * 2; // slight vertical adjustment with height
  const chinAngle = (i - 5) * 4; // forward tilt indicator

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 200 160"
        className="mx-auto block h-auto w-full max-w-[320px]"
        role="img"
        aria-label="Chin projection"
      >
        {/* Riedel plane reference */}
        <line
          x1={70}
          y1={50}
          x2={70}
          y2={150}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text
          x={74}
          y={62}
          fontSize="8"
          fontWeight="600"
          fill="#aab2bd"
          letterSpacing="0.08em"
        >
          {i18n(language, { en: "REFERENCE", fr: "RÉFÉRENCE" }).toUpperCase()}
        </text>

        {/* Stylised lower-face profile */}
        <path
          d={`M70 30
             Q90 60 86 80
             Q90 92 80 100
             Q ${chinTipX} ${chinTipY - 4} ${chinTipX} ${chinTipY}
             Q ${chinTipX - 4} ${chinTipY + 12} 60 ${chinTipY + 16}`}
          fill="rgba(154,174,181,0.16)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        {/* Lip / nose markers */}
        <circle cx={86} cy={80} r={2} fill="#cfdde2" />
        <circle cx={80} cy={100} r={2} fill="#cfdde2" />
        <circle cx={chinTipX} cy={chinTipY} r={3.5} fill="#e9f1f4" />

        {/* Projection arrow */}
        <line
          x1={70}
          y1={chinTipY}
          x2={chinTipX - 2}
          y2={chinTipY}
          stroke="#86efac"
          strokeWidth={1.6}
        />
        <polygon
          points={`${chinTipX - 6},${chinTipY - 3} ${chinTipX},${chinTipY} ${chinTipX - 6},${chinTipY + 3}`}
          fill="#86efac"
        />

        {/* Inclination indicator */}
        <line
          x1={chinTipX}
          y1={chinTipY}
          x2={chinTipX + Math.cos((chinAngle * Math.PI) / 180) * 18}
          y2={chinTipY + Math.sin((chinAngle * Math.PI) / 180) * 18}
          stroke="#fcd34d"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </svg>
      <div className="flex items-center justify-center gap-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-[#86efac]" />
          {i18n(language, { en: "Projection", fr: "Projection" })}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-[#fcd34d]" />
          {i18n(language, { en: "Inclination", fr: "Inclinaison" })}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Main view
 * ------------------------------------------------------------------------- */

export interface ChinWorkerViewProps {
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function ChinWorkerView({ aggregates, language }: ChinWorkerViewProps) {
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

  const overall = getScore(aggregates, "overall_chin");

  // Shape & contour
  const shapeEnum = getEnum(aggregates, "shape_and_contour.chin_shape");
  const shapeKey = normalizeChin(shapeEnum.value);
  const shapeDisplay = formatEnumValue("shape_and_contour.chin_shape", shapeEnum.value);
  const contour = getScore(aggregates, "shape_and_contour.chin_contour");
  const fullness = getScore(aggregates, "shape_and_contour.chin_fullness");
  const dimpleEnum = getEnum(aggregates, "shape_and_contour.chin_dimple");

  // Projection
  const projection = getScore(aggregates, "projection_and_profile.chin_projection");
  const inclination = getScore(aggregates, "projection_and_profile.chin_inclination");
  const height = getScore(aggregates, "projection_and_profile.chin_height");

  // Width
  const width = getScore(aggregates, "width_and_balance.chin_width");
  const harmony = getScore(aggregates, "width_and_balance.chin_to_jaw_harmony");
  const lowerFaceBalance = getScore(
    aggregates,
    "width_and_balance.lower_face_balance",
  );

  return (
    <div className="space-y-4">
      <WorkerHero
        eyebrow={i18n(language, { en: "Chin architecture", fr: "Architecture du menton" })}
        title={i18n(language, {
          en: "Your chin signature",
          fr: "Ta signature mentonnière",
        })}
        argument={overall.argument}
        score={calculateWorkerFaceScore(WORKER_KEY, aggregates)}
        scoreFractionDigits={2}
        rightSlot={
          shapeDisplay ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {i18n(language, { en: "Chin shape", fr: "Forme" })}
              </p>
              <p className="mt-1 font-display text-base font-bold text-white">
                {shapeDisplay}
              </p>
            </div>
          ) : null
        }
      />

      {/* Shape gallery */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {i18n(language, { en: "Frontal taxonomy", fr: "Taxonomie frontale" })}
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, {
                en: "Where your chin sits",
                fr: "Où se situe ton menton",
              })}
            </h3>
            {shapeEnum.argument ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                {shapeEnum.argument}
              </p>
            ) : null}
          </div>
          <ChinShapeGallery selected={shapeKey} language={language} />
        </CardContent>
      </Card>

      {/* Projection diagram */}
      <Card className={workerSectionCardClassName}>
        <CardContent className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {i18n(language, { en: "Profile read", fr: "Lecture de profil" })}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {i18n(language, {
                  en: "Projection × inclination",
                  fr: "Projection × inclinaison",
                })}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "The dashed line is your reference vertical (Riedel plane). The chin tip moves forward or backward depending on your projection score.",
                  fr: "La ligne pointillée est ta verticale de référence (plan de Riedel). La pointe du menton avance ou recule selon ta projection.",
                })}
              </p>
            </div>
            <ChinProjectionDiagram
              projection={projection.score}
              inclination={inclination.score}
              height={height.score}
              language={language}
            />
          </div>
        </CardContent>
      </Card>

      {/* Detailed bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell
          eyebrow={i18n(language, { en: "Shape & contour", fr: "Forme et contour" })}
          title={i18n(language, {
            en: "Volume & detail",
            fr: "Volume et détail",
          })}
        >
          <ScoreBar
            label={formatLabel("shape_and_contour.chin_contour")}
            score={contour.score}
            argument={contour.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("shape_and_contour.chin_fullness")}
            score={fullness.score}
            argument={fullness.argument}
            language={language}
          />
          {dimpleEnum.value ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">
                  {formatLabel("shape_and_contour.chin_dimple")}
                </span>
                <span className="text-sm font-semibold text-white">
                  {formatEnumValue("shape_and_contour.chin_dimple", dimpleEnum.value)}
                </span>
              </div>
              {dimpleEnum.argument ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  {dimpleEnum.argument}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Projection", fr: "Projection" })}
          title={i18n(language, {
            en: "Forward push & height",
            fr: "Avancée et hauteur",
          })}
        >
          <ScoreBar
            label={formatLabel("projection_and_profile.chin_projection")}
            score={projection.score}
            argument={projection.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("projection_and_profile.chin_inclination")}
            score={inclination.score}
            argument={inclination.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("projection_and_profile.chin_height")}
            score={height.score}
            argument={height.argument}
            language={language}
          />
        </SectionShell>

        <SectionShell
          eyebrow={i18n(language, { en: "Width & balance", fr: "Largeur et équilibre" })}
          title={i18n(language, {
            en: "Harmony with the jaw",
            fr: "Harmonie avec la mâchoire",
          })}
        >
          <ScoreBar
            label={formatLabel("width_and_balance.chin_width")}
            score={width.score}
            argument={width.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("width_and_balance.chin_to_jaw_harmony")}
            score={harmony.score}
            argument={harmony.argument}
            language={language}
          />
          <ScoreBar
            label={formatLabel("width_and_balance.lower_face_balance")}
            score={lowerFaceBalance.score}
            argument={lowerFaceBalance.argument}
            language={language}
          />
        </SectionShell>
      </div>
    </div>
  );
}
