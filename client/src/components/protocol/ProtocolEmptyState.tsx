import * as React from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { ProtocolHubNavTabs } from "@/components/protocol/ProtocolHubNavTabs";
import { ProtocolPageShell, ProtocolPageTitle } from "@/components/protocol/ProtocolPageShell";

/** Blurred preview behind the empty-state modal (structure aligned with the real page). */
function ProtocolEmptyBackdrop({ language }: { language: AppLanguage }) {
  return (
    <ProtocolPageShell
      topNav={<ProtocolHubNavTabs language={language} active="protocol" />}
      header={<ProtocolPageTitle language={language} />}
    >
      <div className="space-y-8" aria-hidden>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-white/10 bg-white/[0.06]"
            />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-white/10 bg-white/[0.06]"
            />
          ))}
        </div>
      </div>
    </ProtocolPageShell>
  );
}

type InsetBounds = { top: number; left: number; width: number; height: number };

/** Tracks the on-screen box of `main[data-slot=sidebar-inset]` so a portaled overlay can dim the wave background in the whole pane, not just the `max-w-7xl` column. */
function useSidebarInsetBounds(anchorEl: HTMLElement | null): InsetBounds | null {
  const [bounds, setBounds] = React.useState<InsetBounds | null>(null);

  React.useLayoutEffect(() => {
    const node = anchorEl?.closest(
      'main[data-slot="sidebar-inset"]',
    );
    if (!(node instanceof HTMLElement)) {
      setBounds(null);
      return;
    }

    const sync = (): void => {
      const r = node.getBoundingClientRect();
      setBounds({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [anchorEl]);

  return bounds;
}

export type ProtocolEmptyVariant = "needs_analysis" | "legacy_saved";

export interface ProtocolEmptyExperienceProps {
  language: AppLanguage;
  latestAnalysisId: string | null;
  /** @default "legacy_saved" */
  variant?: ProtocolEmptyVariant;
}

/**
 * Overlay is portaled with `position: fixed` sized to the **`SidebarInset`** main
 * element: it covers padding, full width of that pane, and the wave background
 * visible there — without sitting on top of the left sidebar. The modal is
 * centred inside that same rectangle.
 */
export function ProtocolEmptyExperience({
  language,
  latestAnalysisId,
  variant = "legacy_saved",
}: ProtocolEmptyExperienceProps) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const bounds = useSidebarInsetBounds(anchorEl);

  const needsAnalysis = variant === "needs_analysis";

  const ctaHref = needsAnalysis
    ? latestAnalysisId
      ? `/app/analyses/${latestAnalysisId}`
      : "/app"
    : latestAnalysisId
      ? `/app/analyses/${latestAnalysisId}`
      : "/app";

  const ctaLabel = needsAnalysis
    ? i18n(language, {
        en: "Run your first analysis",
        fr: "Lancer ta première analyse",
      })
    : latestAnalysisId
      ? i18n(language, {
          en: "Go to recommendations",
          fr: "Aller aux recommandations",
        })
      : i18n(language, {
          en: "Open analyses",
          fr: "Voir mes analyses",
        });

  const emptyTitle = needsAnalysis
    ? i18n(language, {
        en: "Your protocol starts after your first analysis",
        fr: "Ton protocole démarre après ta première analyse",
      })
    : i18n(language, {
        en: "Nothing in your protocol yet",
        fr: "Aucun élément dans ton protocole pour l'instant",
      });

  const emptyDesc = needsAnalysis
    ? i18n(language, {
        en: "Complete a face analysis to unlock your personalised daily routine — skincare, habits, and what to avoid.",
        fr: "Termine une analyse pour débloquer ta routine quotidienne sur mesure — soins, habitudes et éléments à bannir.",
      })
    : i18n(language, {
        en: "When you open an analysis, use the Recommendations tab and add items with “Add to my protocol”. Everything you choose is collected here across all analyses, grouped by part of your day.",
        fr: "Depuis une analyse, ouvre l'onglet Recommandations puis ajoute des éléments avec « Ajouter à mon protocole ». Tout ce que tu sélectionnes se retrouve ici pour tout le compte, groupé selon les moments du jour.",
      });

  const modalCard = (
    <div
      className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-7 text-zinc-900 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.28)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="protocol-empty-title"
      aria-describedby="protocol-empty-desc"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {i18n(language, {
          en: "Getting started",
          fr: "Premiers pas",
        })}
      </p>
      <h2
        id="protocol-empty-title"
        className="mt-2 font-display text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl"
      >
        {emptyTitle}
      </h2>
      <p
        id="protocol-empty-desc"
        className="mt-3 text-sm leading-relaxed text-zinc-600"
      >
        {emptyDesc}
      </p>
      <div className="mt-6">
        <Link href={ctaHref}>
          <Button className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800">
            {ctaLabel}
          </Button>
        </Link>
      </div>
    </div>
  );

  const portal =
    bounds && typeof document !== "undefined"
      ? createPortal(
          <div
            className="pointer-events-auto fixed z-[60] box-border overflow-hidden"
            style={{
              top: bounds.top,
              left: bounds.left,
              width: bounds.width,
              height: bounds.height,
            }}
          >
            <div
              className="absolute inset-0 bg-white/75 backdrop-blur-md"
              aria-hidden
            />
            <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
              {modalCard}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={setAnchorEl} className="relative isolate min-h-[min(72vh,640px)]">
        <div className="pointer-events-none select-none blur-[6px] brightness-[0.97]">
          <ProtocolEmptyBackdrop language={language} />
        </div>
      </div>
      {portal}
    </>
  );
}
