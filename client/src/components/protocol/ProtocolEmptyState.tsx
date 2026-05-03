import * as React from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { ProtocolSlot } from "@/lib/protocol-slots";
import type { ProtocolItem } from "@/lib/protocol";
import { ProtocolDay } from "@/components/protocol/ProtocolDay";
import { ProtocolHeaderStats } from "@/components/protocol/ProtocolHeader";

function SlotPreviewStrip({ language }: { language: AppLanguage }) {
  const labels = [
    {
      key: "weekly",
      title: i18n(language, {
        en: "Weekly cadence",
        fr: "Cadence hebdomadaire",
      }),
    },
    {
      key: "general",
      title: i18n(language, {
        en: "Always-on rules",
        fr: "Règles permanentes",
      }),
    },
    {
      key: "cures",
      title: i18n(language, {
        en: "Active cures",
        fr: "Cures actives",
      }),
    },
  ] as const;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {labels.map((row) => (
        <div
          key={row.key}
          className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.12),transparent_40%),linear-gradient(145deg,rgba(10,16,22,0.88)_0%,rgba(20,31,39,0.85)_50%,rgba(185,204,209,0.12)_100%)] p-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {row.title}
          </p>
          <div className="mt-3 space-y-2">
            <div className="h-3 max-w-[82%] rounded bg-white/[0.06]" />
            <div className="h-3 max-w-[58%] rounded bg-white/[0.05]" />
            <div className="h-3 max-w-[42%] rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Blurred preview of the protocol layout (in-flow; dimming is applied via portal overlay). */
function ProtocolEmptyBackdrop({ language }: { language: AppLanguage }) {
  const emptyBySlot = React.useMemo(
    () => new Map<ProtocolSlot, ProtocolItem[]>(),
    [],
  );

  return (
    <div className="space-y-6" aria-hidden>
      <ProtocolHeaderStats
        language={language}
        total={0}
        dailyCount={0}
        weeklyCount={0}
        cureCount={0}
        ruleCount={0}
      />
      <ProtocolDay itemsBySlot={emptyBySlot} language={language} />
      <SlotPreviewStrip language={language} />
      <div className="border-t border-white/5 pt-4" aria-hidden />
    </div>
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

export interface ProtocolEmptyExperienceProps {
  language: AppLanguage;
  latestAnalysisId: string | null;
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
}: ProtocolEmptyExperienceProps) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const bounds = useSidebarInsetBounds(anchorEl);

  const ctaHref = latestAnalysisId
    ? `/app/analyses/${latestAnalysisId}`
    : "/app";

  const ctaLabel = latestAnalysisId
    ? i18n(language, {
        en: "Go to recommendations",
        fr: "Aller aux recommandations",
      })
    : i18n(language, {
        en: "Open analyses",
        fr: "Voir mes analyses",
      });

  const modalCard = (
    <div
      className="w-full max-w-md rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_30%_-10%,rgba(255,255,255,0.14),transparent_42%),linear-gradient(165deg,rgba(22,31,41,0.98)_0%,rgba(14,21,29,0.99)_52%,rgba(12,17,23,1)_100%)] p-7 shadow-[0_32px_120px_-40px_rgba(0,0,0,0.95)]"
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
        className="mt-2 font-display text-xl font-bold tracking-tight text-white sm:text-2xl"
      >
        {i18n(language, {
          en: "Nothing in your protocol yet",
          fr: "Aucun élément dans ton protocole pour l'instant",
        })}
      </h2>
      <p
        id="protocol-empty-desc"
        className="mt-3 text-sm leading-relaxed text-zinc-400"
      >
        {i18n(language, {
          en: "When you open an analysis, use the Recommendations tab and add items with “Add to my protocol”. Everything you choose is collected here across all analyses, grouped by part of your day.",
          fr: "Depuis une analyse, ouvre l'onglet Recommandations puis ajoute des éléments avec « Ajouter à mon protocole ». Tout ce que tu sélectionnes se retrouve ici pour tout le compte, groupé selon les moments du jour.",
        })}
      </p>
      <div className="mt-6">
        <Link href={ctaHref}>
          <Button className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-100">
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
              className="absolute inset-0 bg-[#0a0e12]/84 backdrop-blur-md"
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
        <div className="pointer-events-none select-none blur-[7px] brightness-[0.88] saturate-75">
          <ProtocolEmptyBackdrop language={language} />
        </div>
      </div>
      {portal}
    </>
  );
}
