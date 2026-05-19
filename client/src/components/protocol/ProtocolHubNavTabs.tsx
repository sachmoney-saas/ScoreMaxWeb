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
const APP_SCROLL_REGION_SELECTOR = "[data-app-scroll-region]";

export interface ProtocolHubNavTabsProps {
  language: AppLanguage;
  active: ProtocolHubNavTab;
}

function shouldKeepCurrentScroll(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  );
}

function scrollAppRegionToTop(): void {
  if (typeof document === "undefined") return;

  const resetScroll = () => {
    const appScrollRegion = document.querySelector(APP_SCROLL_REGION_SELECTOR);
    if (appScrollRegion instanceof HTMLElement) {
      appScrollRegion.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  resetScroll();
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(resetScroll);
  }
}

function handleHubNavClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  selected: boolean,
): void {
  if (selected || shouldKeepCurrentScroll(event)) return;
  scrollAppRegionToTop();
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
          onClick={(event) => handleHubNavClick(event, protocolSelected)}
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
          onClick={(event) => handleHubNavClick(event, recSelected)}
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
