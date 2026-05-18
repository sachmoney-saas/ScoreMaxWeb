import * as React from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Layers,
  Loader2,
} from "lucide-react";
import { ONBOARDING_HERO_MIN_LANDMARKS } from "@/lib/face-capture/build-face-mesh-3d";
import type { BuildFaceMesh3DFrame, HeroMetricHighlight } from "@/lib/face-capture/build-face-mesh-3d";
import {
  averageCanthalTiltDegreesFromLandmarks,
  canthalTiltDisplayCategoryFromMeanDegrees,
  formatMouthNoseWidthRatioForDisplay,
  mouthToNoseWidthRatioFromLandmarks,
} from "@/lib/face-capture/admin-capture-guidelines";
import type { LandmarkPoint } from "@/lib/face-capture/types";
import { saasGlassInsetClassName } from "@/lib/auth-page-shell-styles";
import { onboardingPrimaryCtaClassName } from "@/lib/cta-button-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { onboardingPortraitAspectClassName } from "@/lib/onboarding-portrait-media";
import { cn } from "@/lib/utils";

const SCAN_SUMMARY_HIGHLIGHT: HeroMetricHighlight = "scan_summary";

type Props = {
  language: AppLanguage;
  frontalLandmarks: LandmarkPoint[];
  landmarkFrame?: BuildFaceMesh3DFrame;
  onContinue: () => void;
  onReviewPoses?: () => void;
  isContinuing?: boolean;
  isSavingCaptures?: boolean;
  continueDisabled?: boolean;
  continueLabel?: string;
};

export function OnboardingScanCompleteScreen({
  language,
  frontalLandmarks,
  landmarkFrame,
  onContinue,
  onReviewPoses,
  isContinuing = false,
  isSavingCaptures = false,
  continueDisabled = false,
  continueLabel,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const rendererRef = React.useRef<import("@/lib/face-capture/FaceMeshHeroRenderer").FaceMeshHeroRenderer | null>(
    null,
  );
  const dragRef = React.useRef({ active: false, startX: 0, startY: 0, yaw: 0, pitch: 0 });
  const [webglReady, setWebglReady] = React.useState(false);

  const hasEnoughLandmarks =
    frontalLandmarks.length >= ONBOARDING_HERO_MIN_LANDMARKS;

  const mouthNoseRatio = React.useMemo(
    () => (hasEnoughLandmarks ? mouthToNoseWidthRatioFromLandmarks(frontalLandmarks) : null),
    [frontalLandmarks, hasEnoughLandmarks],
  );

  const canthalTiltDeg = React.useMemo(
    () =>
      hasEnoughLandmarks
        ? averageCanthalTiltDegreesFromLandmarks(frontalLandmarks, landmarkFrame)
        : null,
    [frontalLandmarks, hasEnoughLandmarks, landmarkFrame],
  );

  const ratioLabel =
    mouthNoseRatio != null
      ? formatMouthNoseWidthRatioForDisplay(language, mouthNoseRatio)
      : "—";

  const canthalCategory =
    canthalTiltDeg != null
      ? canthalTiltDisplayCategoryFromMeanDegrees(canthalTiltDeg)
      : null;

  const canthalCategoryLabel =
    canthalCategory != null
      ? i18n(
          language,
          (
            {
              positive: { en: "Positive", fr: "Positif" },
              neutral: { en: "Neutral", fr: "Neutre" },
              negative: { en: "Negative", fr: "Négatif" },
            } as const
          )[canthalCategory],
        )
      : "—";

  const canthalDegreeStr =
    canthalTiltDeg != null
      ? canthalTiltDeg.toLocaleString(language === "fr" ? "fr-FR" : "en-US", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : null;

  const reducedMotion = React.useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  React.useEffect(() => {
    let disposed = false;
    let renderer: import("@/lib/face-capture/FaceMeshHeroRenderer").FaceMeshHeroRenderer | null =
      null;

    let ro: ResizeObserver | null = null;

    void (async () => {
      const { FaceMeshHeroRenderer } = await import(
        "@/lib/face-capture/FaceMeshHeroRenderer"
      );
      if (disposed || !canvasRef.current) return;

      renderer = new FaceMeshHeroRenderer();
      renderer.init(canvasRef.current);
      renderer.setIdleEnabled(!reducedMotion);
      renderer.setLandmarks(frontalLandmarks, landmarkFrame);
      renderer.setHighlight(SCAN_SUMMARY_HIGHLIGHT);
      renderer.start();
      rendererRef.current = renderer;
      setWebglReady(true);

      ro = new ResizeObserver(() => {
        const el = viewportRef.current;
        if (!el || !rendererRef.current) return;
        rendererRef.current.resize(el.clientWidth, el.clientHeight);
      });
      if (viewportRef.current) {
        ro.observe(viewportRef.current);
        renderer.resize(
          viewportRef.current.clientWidth,
          viewportRef.current.clientHeight,
        );
      }
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      setWebglReady(false);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [frontalLandmarks, landmarkFrame, reducedMotion]);

  React.useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.setLandmarks(frontalLandmarks, landmarkFrame);
    rendererRef.current.setHighlight(SCAN_SUMMARY_HIGHLIGHT);
  }, [frontalLandmarks, landmarkFrame]);

  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    dragRef.current.active = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active || !rendererRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const yaw = Math.max(-0.35, Math.min(0.35, dragRef.current.yaw + dx * 0.004));
    const pitch = Math.max(-0.2, Math.min(0.2, dragRef.current.pitch + dy * 0.003));
    rendererRef.current.setDragRotation(yaw, pitch);
  }, []);

  const onPointerUp = React.useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.yaw = Math.max(
      -0.35,
      Math.min(0.35, dragRef.current.yaw + dx * 0.004),
    );
    dragRef.current.pitch = Math.max(
      -0.2,
      Math.min(0.2, dragRef.current.pitch + dy * 0.003),
    );
    dragRef.current.active = false;
  }, []);

  return (
    <motion.div
      // Layout 100% fluide : `gap` + paddings + tailles internes en
      // `clamp(min, vh, max)` pour que tout l'écran (titre → bouton CTA)
      // tienne sans scroll dans le panneau onboarding, quelle que soit la
      // hauteur dispo. `overflow-hidden` est le filet de sécurité.
      className="flex min-h-0 flex-1 flex-col gap-[clamp(0.35rem,1.3vh,1rem)] overflow-hidden px-1 py-[clamp(0.35rem,1.2vh,1rem)] sm:px-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <header className="shrink-0 text-center">
        <h2 className="font-hero text-[clamp(1.1rem,3vh,1.65rem)] font-semibold leading-[1.06] tracking-[-0.015em] text-white">
          {i18n(language, {
            en: "Your scan is complete",
            fr: "Ton scan est terminé",
          })}
        </h2>
        <p className="mt-[clamp(0.2rem,0.6vh,0.5rem)] text-[clamp(0.8rem,1.6vh,1rem)] leading-relaxed text-zinc-300">
          {i18n(language, {
            en: "We've captured your unique facial structure",
            fr: "Nous avons capturé la structure unique de ton visage",
          })}
        </p>
      </header>

      <motion.div
        className="mx-auto flex shrink-0 items-center justify-center gap-2 px-2 text-center text-[clamp(0.78rem,1.5vh,0.9375rem)] font-medium text-zinc-300"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
        {i18n(language, {
          en: "3D mapping • 478 facial landmarks",
          fr: "Cartographie 3D • 478 repères faciaux",
        })}
      </motion.div>

      <motion.div
        ref={viewportRef}
        className={cn(
          "relative mx-auto w-full shrink-0 max-h-[min(30dvh,260px)] sm:max-h-[min(34dvh,320px)]",
          onboardingPortraitAspectClassName,
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 h-full w-full touch-none cursor-grab active:cursor-grabbing",
            !webglReady && "opacity-0",
            webglReady && "opacity-100 transition-opacity duration-500",
          )}
          aria-hidden
        />
      </motion.div>

      <div
        className={cn(
          "mx-auto grid w-full max-w-lg shrink-0 gap-2 px-0.5 text-center [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] text-xs sm:max-w-2xl sm:gap-2.5 sm:text-sm",
        )}
      >
        <div
          className={cn(
            "min-w-0 rounded-xl px-2.5 py-[clamp(0.4rem,1.1vh,0.625rem)] sm:px-3",
            saasGlassInsetClassName,
          )}
        >
          <p className="text-[0.65rem] font-medium uppercase leading-tight tracking-wide text-zinc-500 sm:text-[0.72rem]">
            {i18n(language, {
              en: "Canthal tilt",
              fr: "Inclinaison canthale",
            })}
          </p>
          <p className="mt-0.5 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0">
            {canthalTiltDeg != null ? (
              <>
                <span className="text-[clamp(0.9rem,2vh,1.125rem)] font-semibold text-sky-100">
                  {canthalCategoryLabel}
                </span>
                <span className="text-[0.7rem] tabular-nums text-zinc-500 sm:text-xs">
                  {canthalDegreeStr}°
                </span>
              </>
            ) : (
              <span className="text-[clamp(0.9rem,2vh,1.125rem)] font-semibold text-sky-100">—</span>
            )}
          </p>
        </div>
        <div
          className={cn(
            "min-w-0 rounded-xl px-2.5 py-[clamp(0.4rem,1.1vh,0.625rem)] sm:px-3",
            saasGlassInsetClassName,
          )}
        >
          <p className="text-[0.65rem] font-medium uppercase leading-tight tracking-wide text-zinc-500 sm:text-[0.72rem]">
            {i18n(language, {
              en: "Mouth / nose ratio",
              fr: "Ratio bouche / nez",
            })}
          </p>
          <p className="mt-0.5 tabular-nums text-[clamp(0.9rem,2vh,1.125rem)] font-semibold text-sky-100">
            {ratioLabel}
          </p>
        </div>
        <div
          className={cn(
            "relative min-w-0 rounded-xl border border-dashed border-[#d6e4ff]/45 bg-gradient-to-b from-[#d6e4ff]/[0.14] via-white/[0.04] to-transparent py-[clamp(0.4rem,1.1vh,0.625rem)] pl-2 pr-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(214,228,255,0.08)] sm:px-3",
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
            aria-hidden
          >
            <div className="absolute -right-2 -top-2 size-12 rounded-full bg-[#d6e4ff]/10 blur-xl" />
          </div>
          <div className="relative z-[1] min-w-0">
            <p className="text-center text-[clamp(0.52rem,2.35vw+0.15rem,0.72rem)] font-medium uppercase leading-[1.15] tracking-tight text-[#d6e4ff]/85">
              {i18n(language, {
                en: "Measurements",
                fr: "Mesures",
              })}
            </p>
            <div className="mt-0.5 flex min-w-0 items-center justify-center gap-1 sm:gap-1.5 sm:gap-2">
              <Layers
                className="size-3 shrink-0 text-[#d6e4ff]/80 sm:size-3.5 md:size-4"
                strokeWidth={2}
                aria-hidden
              />
              <p className="tabular-nums text-[clamp(0.82rem,1.85vh+0.25rem,1.125rem)] font-semibold text-white">
                120+
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="shrink-0 text-center text-[clamp(0.78rem,1.5vh,0.875rem)] text-zinc-400">
        {i18n(language, {
          en: "Let's see where you stand…",
          fr: "Voyons où tu te situes…",
        })}
      </p>

      <motion.div
        className="mx-auto flex w-full max-w-lg shrink-0 flex-col items-center gap-[clamp(0.4rem,1vh,0.75rem)] sm:max-w-2xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {isSavingCaptures ? (
          <p className="text-center text-xs text-zinc-400">
            {i18n(language, {
              en: "Saving your photos…",
              fr: "Enregistrement de tes photos…",
            })}
          </p>
        ) : null}
        <button
          type="button"
          disabled={isContinuing || continueDisabled || isSavingCaptures}
          onClick={onContinue}
          className={cn(
            "mx-auto flex w-full min-w-[10.5rem] max-w-[min(15rem,88vw)] items-center justify-center px-6 py-[clamp(0.55rem,1.4vh,0.875rem)] text-base font-semibold transition disabled:opacity-60",
            onboardingPrimaryCtaClassName,
          )}
        >
          {isContinuing ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
          ) : null}
          {continueLabel ?? i18n(language, { en: "Continue", fr: "Continuer" })}
        </button>
      </motion.div>
    </motion.div>
  );
}
