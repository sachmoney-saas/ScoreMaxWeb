import * as React from "react";
import { Link, useSearch } from "wouter";

import {
  analysisTabBarGlassClassName,
  appHubTabLinkActiveClassName,
  appHubTabLinkInactiveClassName,
} from "@/components/analysis/workers/_shared";
import { buildAnalysisViewHref } from "@/lib/analysis-view-href";
import { cn } from "@/lib/utils";

export type AnalysisTopNavActiveTab = "overview" | "recommendations";

export interface AnalysisTopNavTabsProps {
  jobId: string;
  /** Onglet courant : sur une page worker, utiliser `overview` pour aligner l’état actif sur la vue détail. */
  active: AnalysisTopNavActiveTab;
}

/**
 * Overview / Recommandations — mêmes pastilles que sur la page analyse,
 * centrées. Sur page worker, liens vers la vue analyse ; `active="overview"` garde Overview en surbrillance.
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
            overviewActive ? appHubTabLinkActiveClassName : appHubTabLinkInactiveClassName
          }
        >
          <span className="relative z-10">Overview</span>
        </Link>
        <Link
          href={recommendationsHref}
          className={
            recActive ? appHubTabLinkActiveClassName : appHubTabLinkInactiveClassName
          }
        >
          <span className="relative z-10">Recommandations</span>
        </Link>
      </nav>
    </div>
  );
}
