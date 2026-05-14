import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BodyfatCompositionMatrixVisual } from "@/components/analysis/workers/BodyfatCompositionMatrix";
import {
  WorkerSignatureRadar,
  type WorkerSignatureRadarPoint,
} from "@/components/analysis/workers/WorkerVisualizations";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Données décoratives façon bon profil (~PSL 7) — pas liées à une analyse réelle. */
const MOCK_LEANNESS = 7.45;
const MOCK_SHARPNESS = 7.65;

const floatCardClassName =
  "rounded-2xl border border-white/[0.26] bg-[rgba(10,16,22,0.62)] px-4 py-4 shadow-[0_22px_56px_-18px_rgba(0,0,0,0.88)] backdrop-blur-[14px] sm:rounded-[1.35rem] sm:px-5 sm:py-5";

function buildRadarData(language: AppLanguage): WorkerSignatureRadarPoint[] {
  return [
    { label: i18n(language, { en: "Harmony", fr: "Harmonie" }), score: 7.6 },
    { label: i18n(language, { en: "Projection", fr: "Projection" }), score: 7.9 },
    { label: i18n(language, { en: "Eyes", fr: "Yeux" }), score: 7.5 },
    { label: i18n(language, { en: "Symmetry", fr: "Symétrie" }), score: 7.7 },
    { label: i18n(language, { en: "Jawline", fr: "Mâchoire" }), score: 8.0 },
    { label: i18n(language, { en: "Skin", fr: "Peau" }), score: 7.4 },
  ];
}

function CompleteAnalysisColoringCard({ language }: { language: AppLanguage }) {
  const swatches: { zone: string; hex: string }[] = [
    { zone: i18n(language, { en: "Hair", fr: "Cheveux" }), hex: "#3d2419" },
    { zone: i18n(language, { en: "Skin", fr: "Peau" }), hex: "#d8a37a" },
    { zone: i18n(language, { en: "Brows", fr: "Sourcils" }), hex: "#3d2419" },
    { zone: i18n(language, { en: "Lips", fr: "Lèvres" }), hex: "#b86b5c" },
  ];

  return (
    <div className="w-full min-w-0 max-w-[20rem]">
      <p className={cn(cardTitleClass, "mb-2.5 !mt-0 sm:mb-3")}>
        {i18n(language, { en: "Coloring", fr: "Colorimétrie" })}
      </p>
      <div className="grid grid-cols-4 gap-x-2.5 gap-y-3 rounded-xl border border-white/14 bg-white/[0.04] p-3 sm:gap-x-3 sm:p-3.5">
        {swatches.map((s) => (
          <div key={s.zone} className="flex min-w-0 flex-col items-center gap-2">
            <span className="w-full text-center text-[11px] font-semibold uppercase leading-snug tracking-[0.06em] text-zinc-300 sm:text-xs sm:leading-tight">
              {s.zone}
            </span>
            <div
              className="h-10 w-full min-w-0 rounded-lg border border-white/12 shadow-inner sm:h-11"
              style={{ backgroundColor: s.hex }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type FloatPaneProps = {
  className?: string;
  delay: number;
  reduceMotion: boolean | null;
  children: React.ReactNode;
};

/** Panneau décoratif — flux normal (grille), pas en absolute au-dessus du portrait. */
function FloatPane({ className, delay, reduceMotion, children }: FloatPaneProps) {
  return (
    <motion.div
      className={cn("will-change-transform", className)}
      initial={false}
      animate={
        reduceMotion
          ? { y: 0, x: 0, rotate: 0 }
          : {
              y: [0, -6, 0, 4, 0],
              x: [0, 3, 0, -2, 0],
              rotate: [-0.35, 0.4, -0.2, 0.3, -0.35],
            }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: 8 + delay * 0.45,
              repeat: Infinity,
              ease: "easeInOut",
              delay,
            }
      }
    >
      {children}
    </motion.div>
  );
}

const cardTitleClass =
  "mt-1 text-center text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300 sm:text-sm sm:tracking-[0.13em]";

/**
 * Graphes décoratifs (matrice + toile + colorimétrie) autour du portrait model1 —
 * à partir de `lg`, grille 3 colonnes : cartes dans les marges, jamais au-dessus du visage.
 */
export function LandingCompleteAnalysisOrbit({
  language,
  children,
}: {
  language: AppLanguage;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const radarData = React.useMemo(() => buildRadarData(language), [language]);

  const radarCard = (
    <div
      className={cn(
        floatCardClassName,
        "w-full min-w-0 max-w-[min(100%,32rem)] py-2 sm:py-2.5",
      )}
    >
      <div className="-mx-1 w-[calc(100%+0.5rem)] max-w-none">
        <WorkerSignatureRadar
          data={radarData}
          ariaLabel={i18n(language, {
            en: "Illustrative analysis signature",
            fr: "Signature d'analyse illustrative",
          })}
          sizePreset="xlarge"
          className="max-w-none"
        />
      </div>
    </div>
  );

  const matrixCard = (
    <div
      className={cn(floatCardClassName, "flex w-full min-w-0 max-w-[min(100%,32rem)] flex-col items-center")}
    >
      <BodyfatCompositionMatrixVisual
        leanness={MOCK_LEANNESS}
        sharpness={MOCK_SHARPNESS}
        language={language}
        compact={false}
        size="hero"
      />
      <p className={cn(cardTitleClass, "mt-3")}>
        {i18n(language, { en: "Composition", fr: "Composition" })}
      </p>
    </div>
  );

  const coloringCard = (
    <div
      className={cn(
        floatCardClassName,
        "flex w-full min-w-0 max-w-[min(100%,22rem)] flex-col items-center sm:max-w-[24rem]",
      )}
    >
      <CompleteAnalysisColoringCard language={language} />
    </div>
  );

  return (
    <div className="relative isolate mx-auto w-full max-w-[min(100%,110rem)] px-2 sm:px-4">
      <div
        className={cn(
          "flex flex-col items-stretch",
          /* Centre plus large : portrait hero lisible sans écraser les schémas latéraux. */
          "lg:grid lg:grid-cols-[0.92fr_1.82fr_0.92fr] lg:items-start lg:justify-center",
          "lg:gap-x-4 xl:grid-cols-[0.88fr_1.92fr_0.88fr] xl:gap-x-7 2xl:gap-x-12",
        )}
      >
        <div
          aria-hidden
          className="hidden min-w-0 flex-col items-end gap-8 pt-2 lg:flex xl:gap-10 xl:pt-4"
        >
          <FloatPane
            delay={0}
            reduceMotion={reduceMotion}
            className="w-full max-w-[min(100%,32rem)]"
          >
            {radarCard}
          </FloatPane>
          <FloatPane
            delay={2.2}
            reduceMotion={reduceMotion}
            className="w-full max-w-[min(100%,24rem)]"
          >
            {coloringCard}
          </FloatPane>
        </div>

        <div className="relative z-10 order-first w-full min-w-0 max-w-[min(100%,78rem)] justify-self-center lg:order-none lg:self-end">
          {children}
        </div>

        <div
          aria-hidden
          className="hidden min-w-0 flex-col items-start gap-6 pt-2 lg:flex xl:pt-4"
        >
          <FloatPane
            delay={1.1}
            reduceMotion={reduceMotion}
            className="w-full max-w-[min(100%,32rem)]"
          >
            {matrixCard}
          </FloatPane>
        </div>
      </div>
    </div>
  );
}
