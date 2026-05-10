import * as React from "react";
import { Link } from "wouter";

import {
  analysisTabBarGlassClassName,
  appHubTabLinkActiveClassName,
  appHubTabLinkInactiveClassName,
} from "@/components/analysis/workers/_shared";
import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";

export type ProtocolHubNavTab = "protocol" | "recommendations";

const PROTOCOL_PATH = "/app/protocol";
const PROTOCOL_RECOMMENDATIONS_PATH = "/app/protocol/recommendations";

export interface ProtocolHubNavTabsProps {
  language: AppLanguage;
  active: ProtocolHubNavTab;
}

/**
 * Navigation Protocole / Recommandations — barre glass (comme l’analyse),
 * rendue au-dessus du panneau contenu par `ProtocolPageShell`.
 */
export function ProtocolHubNavTabs({ language, active }: ProtocolHubNavTabsProps) {
  const protocolSelected = active === "protocol";
  const recSelected = active === "recommendations";

  return (
    <div className="flex w-full justify-center">
      <nav
        className={cn(
          analysisTabBarGlassClassName,
          "inline-flex h-auto w-fit max-w-full flex-wrap justify-center gap-1 rounded-2xl p-1.5 text-zinc-300 sm:flex-nowrap",
        )}
        aria-label={i18n(language, {
          en: "Protocol area navigation",
          fr: "Navigation espace protocole",
        })}
      >
        <Link
          href={PROTOCOL_PATH}
          className={
            protocolSelected ? appHubTabLinkActiveClassName : appHubTabLinkInactiveClassName
          }
        >
          <span className="relative z-10">
            {i18n(language, { en: "Protocol", fr: "Protocole" })}
          </span>
        </Link>
        <Link
          href={PROTOCOL_RECOMMENDATIONS_PATH}
          className={
            recSelected ? appHubTabLinkActiveClassName : appHubTabLinkInactiveClassName
          }
        >
          <span className="relative z-10">
            {i18n(language, { en: "Recommendations", fr: "Recommandations" })}
          </span>
        </Link>
      </nav>
    </div>
  );
}
