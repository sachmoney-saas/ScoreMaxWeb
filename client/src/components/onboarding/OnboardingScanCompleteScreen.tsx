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
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-1 py-2 sm:px-2 sm:py-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <header className="shrink-0 text-center">
        <h2 className="font-hero text-[1.35rem] font-semibold leading-[1.06] tracking-[-0.015em] text-white sm:text-[1.65rem]">
          {i18n(language, {
            en: "Your scan is complete",
            fr: "Ton scan est terminé",
          })}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300 sm:text-base">
          {i18n(language, {
            en: "We've captured your unique facial structure",
            fr: "Nous avons capturé la structure unique de ton visage",
          })}
        </p>
      </header>

      <motion.div
        className="mx-auto mt-3 flex shrink-0 items-center justify-center gap-2 px-2 text-center text-sm font-medium text-zinc-300 sm:text-[0.9375rem]"
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
        className="relative mx-auto mt-3 w-full shrink-0 aspect-[3/4] max-h-[min(34dvh,300px)] sm:max-h-[min(38dvh,340px)]"
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
          "mx-auto mt-3 grid w-full max-w-lg shrink-0 grid-cols-3 gap-2 px-0.5 text-center text-xs sm:max-w-2xl sm:gap-2.5 sm:text-sm",
        )}
      >
        <div className={cn("rounded-xl px-2.5 py-2.5 sm:px-3", saasGlassInsetClassName)}>
          <p className="text-[0.65rem] font-medium uppercase leading-tight tracking-wide text-zinc-500 sm:text-[0.72rem]">
            {i18n(language, {
              en: "Canthal tilt",
              fr: "Inclinaison canthale",
            })}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0">
            {canthalTiltDeg != null ? (
              <>
                <span className="text-base font-semibold text-sky-100 sm:text-lg">
                  {canthalCategoryLabel}
                </span>
                <span className="text-[0.7rem] tabular-nums text-zinc-500 sm:text-xs">
                  {canthalDegreeStr}°
                </span>
              </>
            ) : (
              <span className="text-base font-semibold text-sky-100 sm:text-lg">—</span>
            )}
          </p>
        </div>
        <div className={cn("rounded-xl px-2.5 py-2.5 sm:px-3", saasGlassInsetClassName)}>
          <p className="text-[0.65rem] font-medium uppercase leading-tight tracking-wide text-zinc-500 sm:text-[0.72rem]">
            {i18n(language, {
              en: "Mouth / nose ratio",
              fr: "Ratio bouche / nez",
            })}
          </p>
          <p className="mt-1 tabular-nums text-base font-semibold text-sky-100 sm:text-lg">{ratioLabel}</p>
        </div>
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border border-dashed border-sky-400/45 bg-gradient-to-b from-sky-500/[0.14] via-white/[0.04] to-transparent px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(56,189,248,0.08)] sm:px-3",
          )}
        >
          <div
            className="pointer-events-none absolute -right-2 -top-2 size-12 rounded-full bg-sky-400/10 blur-xl"
            aria-hidden
          />
          <p className="text-[0.65rem] font-medium uppercase leading-tight tracking-wide text-sky-200/80 sm:text-[0.72rem]">
            {i18n(language, {
              en: "Measurements",
              fr: "Mesures",
            })}
          </p>
          <div className="mt-1 flex items-center justify-center gap-1.5 sm:gap-2">
            <Layers
              className="size-3.5 shrink-0 text-sky-400/80 sm:size-4"
              strokeWidth={2}
              aria-hidden
            />
            <p className="tabular-nums text-base font-semibold text-white sm:text-lg">120+</p>
          </div>
        </div>
      </div>

      <p className="mt-4 shrink-0 text-center text-sm text-zinc-400 sm:mt-5">
        {i18n(language, {
          en: "Let's see where you stand…",
          fr: "Voyons où tu te situes…",
        })}
      </p>

      <motion.div
        className="mx-auto mt-4 flex w-full max-w-lg shrink-0 flex-col items-center space-y-3 pb-1 sm:max-w-2xl"
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
            "mx-auto flex w-full min-w-[10.5rem] max-w-[min(15rem,88vw)] items-center justify-center px-6 py-3.5 text-base font-semibold transition disabled:opacity-60",
            onboardingPrimaryCtaClassName,
          )}
        >
          {isContinuing ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
          ) : null}
          {continueLabel ?? i18n(language, { en: "Continue", fr: "Continuer" })}
        </button>
        {onReviewPoses ? (
          <button
            type="button"
            disabled={isContinuing || isSavingCaptures}
            onClick={onReviewPoses}
            className="w-full text-center text-sm font-medium text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline disabled:opacity-50"
          >
            {i18n(language, {
              en: "Review captured poses",
              fr: "Vérifier les poses capturées",
            })}
          </button>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
