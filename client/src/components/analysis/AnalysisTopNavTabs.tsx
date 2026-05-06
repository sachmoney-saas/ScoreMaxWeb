import * as React from "react";
import { Link, useSearch } from "wouter";

import {
  analysisTabBarGlassClassName,
} from "@/components/analysis/workers/_shared";
import { buildAnalysisViewHref } from "@/lib/analysis-view-href";
import { cn } from "@/lib/utils";

/** Même base que `TabsTrigger` (inactive). */
const analysisTopNavLinkBaseClassName =
  "relative z-0 inline-flex items-center justify-center rounded-xl border border-transparent px-5 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(14,20,26,0.96)]";

const analysisTopNavLinkInactiveClassName = cn(
  analysisTopNavLinkBaseClassName,
  "text-zinc-400 hover:text-zinc-200",
);

/** Reproduction du style actif métallique Radix, pour les `<Link>`. */
const analysisTopNavLinkActiveClassName = cn(
  analysisTopNavLinkBaseClassName,
  "relative z-0 overflow-hidden font-semibold text-zinc-950",
  "border border-white/40 ring-1 ring-slate-900/15",
  "bg-[linear-gradient(to_top_right,#475569_0%,#cbd5e1_22%,#ffffff_48%,#e8eef5_72%,#64748b_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_8px_rgba(71,85,105,0.22),0_10px_28px_-12px_rgba(0,0,0,0.5),0_4px_12px_-6px_rgba(0,0,0,0.18)]",
  "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit] before:bg-[linear-gradient(118deg,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.08)_38%,transparent_52%,rgba(15,23,42,0.06)_100%)] before:content-['']",
);

export type AnalysisTopNavActiveTab =
  | "overview"
  | "recommendations"
  | "worker";

export interface AnalysisTopNavTabsProps {
  jobId: string;
  /** Onglet courant : sur une page worker, utiliser `worker` (les deux liens sont inactifs visuellement). */
  active: AnalysisTopNavActiveTab;
}

/**
 * Overview / Recommandations — mêmes pastilles que sur la page analyse,
 * centrées. Sur page worker, navigation vers la vue analyse correspondante.
 */
export function AnalysisTopNavTabs({ jobId, active }: AnalysisTopNavTabsProps) {
  const search = useSearch();

  const overviewHref = React.useMemo(
    () => buildAnalysisViewHref(jobId, search, "overview"),
    [jobId, search],
  );
  const recommendationsHref = React.useMemo(
    () => buildAnalysisViewHref(jobId, search, "recommendations"),
    [jobId, search],
  );

  const overviewActive = active === "overview";
  const recActive = active === "recommendations";

  return (
    <div className="flex w-full justify-center">
      <nav
        className={cn(
          analysisTabBarGlassClassName,
          "inline-flex h-auto w-fit max-w-full flex-wrap justify-center gap-1 rounded-2xl p-1.5 text-zinc-300 sm:flex-nowrap",
        )}
        aria-label="Navigation analyse"
      >
        <Link
          href={overviewHref}
          className={
            overviewActive
              ? analysisTopNavLinkActiveClassName
              : analysisTopNavLinkInactiveClassName
          }
        >
          <span className="relative z-10">Overview</span>
        </Link>
        <Link
          href={recommendationsHref}
          className={
            recActive
              ? analysisTopNavLinkActiveClassName
              : analysisTopNavLinkInactiveClassName
          }
        >
          <span className="relative z-10">Recommandations</span>
        </Link>
      </nav>
    </div>
  );
}
