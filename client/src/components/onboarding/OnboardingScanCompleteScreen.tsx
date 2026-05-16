import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Loader2,
  Network,
  Ruler,
} from "lucide-react";
import {
  ONBOARDING_HERO_MIN_LANDMARKS,
  type HeroMetricHighlight,
} from "@/lib/face-capture/build-face-mesh-3d";
import type { BuildFaceMesh3DFrame } from "@/lib/face-capture/build-face-mesh-3d";
import type { LandmarkPoint } from "@/lib/face-capture/types";
import { saasGlassInsetClassName } from "@/lib/auth-page-shell-styles";
import { onboardingPrimaryCtaClassName } from "@/lib/cta-button-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SLIDES: readonly {
  id: HeroMetricHighlight;
  pill: { en: string; fr: string };
}[] = [
  {
    id: "eyes",
    pill: { en: "Canthal Tilt • Eyes", fr: "Inclinaison canthale • Yeux" },
  },
  {
    id: "jaw",
    pill: { en: "Jaw Angle • Structure", fr: "Angle mâchoire • Structure" },
  },
  {
    id: "shape",
    pill: { en: "Face Shape • Proportions", fr: "Forme du visage • Proportions" },
  },
  {
    id: "full",
    pill: { en: "3D Face Map • Complete", fr: "Cartographie 3D • Complète" },
  },
] as const;

type Props = {
  language: AppLanguage;
  frontalLandmarks: LandmarkPoint[];
  landmarkFrame?: BuildFaceMesh3DFrame;
  eyeLandmarks?: LandmarkPoint[];
  eyeLandmarkFrame?: BuildFaceMesh3DFrame;
  onContinue: () => void;
  onReviewPoses: () => void;
  isContinuing?: boolean;
  isSavingCaptures?: boolean;
  continueDisabled?: boolean;
};

export function OnboardingScanCompleteScreen({
  language,
  frontalLandmarks,
  landmarkFrame,
  eyeLandmarks,
  eyeLandmarkFrame,
  onContinue,
  onReviewPoses,
  isContinuing = false,
  isSavingCaptures = false,
  continueDisabled = false,
}: Props) {
  const [slideIndex, setSlideIndex] = React.useState(0);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const rendererRef = React.useRef<import("@/lib/face-capture/FaceMeshHeroRenderer").FaceMeshHeroRenderer | null>(
    null,
  );
  const dragRef = React.useRef({ active: false, startX: 0, startY: 0, yaw: 0, pitch: 0 });
  const [webglReady, setWebglReady] = React.useState(false);

  const slide = SLIDES[slideIndex] ?? SLIDES[0]!;

  const landmarksForSlide = React.useMemo(() => {
    if (
      slide.id === "eyes" &&
      eyeLandmarks &&
      eyeLandmarks.length >= ONBOARDING_HERO_MIN_LANDMARKS
    ) {
      return eyeLandmarks;
    }
    return frontalLandmarks;
  }, [slide.id, eyeLandmarks, frontalLandmarks]);

  const frameForSlide = React.useMemo((): BuildFaceMesh3DFrame | undefined => {
    if (
      slide.id === "eyes" &&
      eyeLandmarks &&
      eyeLandmarks.length >= ONBOARDING_HERO_MIN_LANDMARKS
    ) {
      return eyeLandmarkFrame ?? landmarkFrame;
    }
    return landmarkFrame;
  }, [slide.id, eyeLandmarkFrame, eyeLandmarks, landmarkFrame]);

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
      renderer.setHighlight(slide.id);
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
    if (!rendererRef.current || !landmarksForSlide) return;
    rendererRef.current.setLandmarks(landmarksForSlide, frameForSlide);
    rendererRef.current.setHighlight(slide.id);
  }, [frameForSlide, landmarksForSlide, slide.id]);

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

  const goToSlide = React.useCallback((index: number) => {
    setSlideIndex(Math.max(0, Math.min(SLIDES.length - 1, index)));
  }, []);

  const touchStartX = React.useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) goToSlide(slideIndex + 1);
    else goToSlide(slideIndex - 1);
  };

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

        <div className="mt-4 flex shrink-0 justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-zinc-200 sm:text-sm",
                saasGlassInsetClassName,
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.85)]" />
              {i18n(language, slide.pill)}
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          ref={viewportRef}
          className="relative mx-auto mt-3 w-full shrink-0 aspect-[3/4] max-h-[min(34dvh,300px)] sm:max-h-[min(38dvh,340px)]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
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

        <motion.div
          className="mt-3 flex shrink-0 justify-center gap-2"
          role="tablist"
          aria-label={i18n(language, {
            en: "Scan highlights",
            fr: "Points forts du scan",
          })}
        >
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === slideIndex}
              aria-label={i18n(language, s.pill)}
              onClick={() => goToSlide(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === slideIndex
                  ? "w-6 bg-sky-400"
                  : "w-2 bg-white/25 hover:bg-white/40",
              )}
            />
          ))}
        </motion.div>

        <motion.div
          className={cn(
            "mx-auto mt-3 flex w-full shrink-0 items-center justify-center gap-2 border-sky-400/25 px-4 py-2.5 text-sm font-medium text-sky-100 sm:mt-4",
            saasGlassInsetClassName,
          )}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
          {i18n(language, {
            en: "3D mapping • 478 facial landmarks",
            fr: "Cartographie 3D • 478 repères faciaux",
          })}
        </motion.div>

        <div className="mx-auto mt-3 grid w-full shrink-0 grid-cols-2 gap-3">
          <motion.div
            className={cn("flex flex-col gap-1 px-4 py-3", saasGlassInsetClassName)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Ruler className="h-4 w-4 text-zinc-400" aria-hidden />
            <p className="text-xl font-semibold text-white">20+</p>
            <p className="text-xs text-zinc-400">
              {i18n(language, { en: "Measurements", fr: "Mesures" })}
            </p>
          </motion.div>
          <motion.div
            className={cn("flex flex-col gap-1 px-4 py-3", saasGlassInsetClassName)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Network className="h-4 w-4 text-zinc-400" aria-hidden />
            <p className="text-xl font-semibold text-white">1,200+</p>
            <p className="text-xs text-zinc-400">
              {i18n(language, { en: "Data points", fr: "Points de données" })}
            </p>
          </motion.div>
        </div>

        <p className="mt-4 shrink-0 text-center text-sm text-zinc-400 sm:mt-5">
          {i18n(language, {
            en: "Let's see where you stand…",
            fr: "Voyons où tu te situes…",
          })}
        </p>

        <motion.div
          className="mx-auto mt-4 w-full shrink-0 space-y-3 pb-1"
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
              "flex w-full items-center justify-center px-4 py-3.5 text-base font-semibold transition disabled:opacity-60",
              onboardingPrimaryCtaClassName,
            )}
          >
            {isContinuing ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
            ) : null}
            {i18n(language, { en: "Continue", fr: "Continuer" })}
          </button>
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
        </motion.div>
    </motion.div>
  );
}
