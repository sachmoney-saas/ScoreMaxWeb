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
  "rounded-2xl border border-white/[0.26] bg-[rgba(10,16,22,0.62)] px-2.5 py-3 shadow-[0_22px_56px_-18px_rgba(0,0,0,0.88)] backdrop-blur-[14px] sm:rounded-[1.35rem] sm:px-3 sm:py-3.5";

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
    <div className="w-full min-w-[9.5rem] max-w-[12.5rem]">
      <div className="grid grid-cols-4 gap-x-2 gap-y-2 rounded-xl border border-white/14 bg-white/[0.04] p-2 sm:p-2.5">
        {swatches.map((s) => (
          <div key={s.zone} className="flex flex-col items-center gap-1.5">
            <span className="w-full truncate text-center text-[8px] font-semibold uppercase leading-tight tracking-[0.08em] text-zinc-400 sm:text-[9px]">
              {s.zone}
            </span>
            <div
              className="h-8 w-full min-w-0 rounded-lg border border-white/12 shadow-inner sm:h-9"
              style={{ backgroundColor: s.hex }}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-[10px]">
        {i18n(language, { en: "Contrast · medium", fr: "Contraste · moyen" })}
      </p>
    </div>
  );
}

type OrbitPaneProps = {
  className: string;
  delay: number;
  reduceMotion: boolean | null;
  children: React.ReactNode;
};

function OrbitPane({ className, delay, reduceMotion, children }: OrbitPaneProps) {
  return (
    <motion.div
      className={cn("absolute z-[15] will-change-transform", className)}
      initial={false}
      animate={
        reduceMotion
          ? { y: 0, x: 0, rotate: 0 }
          : {
              y: [0, -9, 0, 6, 0],
              x: [0, 5, 0, -4, 0],
              rotate: [-0.45, 0.5, -0.25, 0.35, -0.45],
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

/**
 * Graphes façon « in-app » (matrice + toile + colorimétrie) qui flottent autour du portrait central
 * de la section « Complete facial analysis » (model1.png) — pas sur la hero du haut.
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

  return (
    <div className="relative isolate mx-auto w-full max-w-[min(100%,62rem)]">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute hidden sm:block",
          "inset-y-[4%]",
          "-left-[4%] -right-[4%] md:-left-[6%] md:-right-[6%] lg:-left-[8%] lg:-right-[8%]",
        )}
      >
        {/* Toile — haut gauche */}
        <OrbitPane
          className="left-0 top-[8%] w-[clamp(13.5rem,min(38vw,22rem),22rem)] md:left-[1%] md:top-[10%]"
          delay={0}
          reduceMotion={reduceMotion}
        >
          <div className={floatCardClassName}>
            <div className="-mx-0.5 w-[calc(100%+0.25rem)] max-w-none">
              <WorkerSignatureRadar
                data={radarData}
                ariaLabel={i18n(language, {
                  en: "Illustrative analysis signature",
                  fr: "Signature d'analyse illustrative",
                })}
                sizePreset="large"
                className="max-w-none"
              />
            </div>
            <p className="mt-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400 sm:text-[10px]">
              {i18n(language, { en: "Web", fr: "Toile" })}
            </p>
          </div>
        </OrbitPane>

        {/* Matrice composition — haut droite */}
        <OrbitPane
          className="right-0 top-[7%] w-[clamp(13rem,min(34vw,20rem),20rem)] md:right-[1%] md:top-[9%]"
          delay={1.1}
          reduceMotion={reduceMotion}
        >
          <div className={cn(floatCardClassName, "flex flex-col items-center")}>
            <div className="origin-center scale-[1.06] md:scale-[1.22]">
              <BodyfatCompositionMatrixVisual
                leanness={MOCK_LEANNESS}
                sharpness={MOCK_SHARPNESS}
                language={language}
                compact={false}
              />
            </div>
            <p className="mt-2 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400 sm:text-[10px]">
              {i18n(language, { en: "Composition", fr: "Composition" })}
            </p>
          </div>
        </OrbitPane>

        {/* Colorimétrie — bas côté portait (épaule) */}
        <OrbitPane
          className="bottom-[6%] left-0 md:bottom-[8%] md:left-[4%]"
          delay={2.2}
          reduceMotion={reduceMotion}
        >
          <div className={cn(floatCardClassName, "flex flex-col items-center")}>
            <CompleteAnalysisColoringCard language={language} />
            <p className="mt-1 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400 sm:text-[10px]">
              {i18n(language, { en: "Coloring", fr: "Colorimétrie" })}
            </p>
          </div>
        </OrbitPane>
      </div>

      <div className="relative z-20">{children}</div>
    </div>
  );
}
