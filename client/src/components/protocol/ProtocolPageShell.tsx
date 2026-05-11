import * as React from "react";

import { scoreRingMatchMetallicPillClassName } from "@/components/analysis/workers/_shared";
import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";

/** Même dégradé que le bouton « Mon protocole » dans la barre latérale. */
export const protocolPageMetallicGradientClassName =
  "bg-[linear-gradient(to_top_right,#475569_0%,#cbd5e1_22%,#ffffff_48%,#e8eef5_72%,#64748b_100%)]";

/**
 * Panneau principal — même famille que les cartes « Vue d’analyse », mais plus léger
 * pour que le WaveBackground passe nettement sous le backdrop-blur.
 * (Sans cadre métal opaque au-dessous : sinon le blur ne « voit » pas le WebGL.)
 */
export const protocolPageBodyGlassClassName = cn(
  "relative isolate mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/12",
  "bg-[radial-gradient(ellipse_110%_95%_at_50%_-35%,rgba(255,255,255,0.16),transparent_52%),linear-gradient(145deg,rgba(9,15,22,0.42)_0%,rgba(24,34,43,0.38)_52%,rgba(154,174,181,0.14)_100%)]",
  "!bg-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_28px_90px_-55px_rgba(0,0,0,0.55),0_36px_100px_-60px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.04] backdrop-blur-md",
);

export const protocolPageTitleClassName =
  "font-display text-2xl font-bold leading-snug tracking-tight text-zinc-950 sm:text-3xl";

function formatProtocolHeaderToday(language: AppLanguage, date: Date): string {
  return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function localDateIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ProtocolPageTitle({ language }: { language: AppLanguage }) {
  const today = new Date();

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <h1 className={protocolPageTitleClassName}>
        {i18n(language, { en: "My protocol", fr: "Mon protocole" })}
      </h1>
      <time
        dateTime={localDateIsoDay(today)}
        className="font-display text-sm font-semibold text-zinc-800/95 sm:text-base"
      >
        {formatProtocolHeaderToday(language, today)}
      </time>
    </div>
  );
}

export interface ProtocolPageShellProps {
  /** Onglets hub (Protocole / Recommandations) — rendus hors du panneau glass, sur le fond de page. */
  topNav?: React.ReactNode;
  /** Bandeau titre — même surface métallique que le bouton sidebar « Mon protocole ». */
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Colonne : onglets hub au-dessus (hors glass), puis panneau glass + bandeau titre métal + contenu.
 */
export function ProtocolPageShell({
  topNav,
  header,
  children,
  className,
}: ProtocolPageShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:gap-4">
      {topNav ? (
        <div className="relative z-[2] shrink-0 px-5 pt-6 pb-1 sm:px-8 sm:pb-2 sm:pt-7">{topNav}</div>
      ) : null}
      <div className={cn(protocolPageBodyGlassClassName, className)}>
        {header ? (
          <div
            className={cn(
              scoreRingMatchMetallicPillClassName,
              "relative z-[2] shrink-0 overflow-visible rounded-b-none rounded-t-2xl border-x-0 border-t-0 border-b border-b-zinc-200/80",
              "px-5 pb-10 pt-9 sm:px-8 sm:pb-11 sm:pt-10",
            )}
          >
            <div className="relative z-10">{header}</div>
          </div>
        ) : null}
        <div className="relative z-0 min-h-0 px-5 py-8 text-zinc-50 sm:px-8 sm:py-9">{children}</div>
      </div>
    </div>
  );
}