import { cn } from "@/lib/utils";
import { protocolPageBodyGlassClassName } from "@/components/protocol/ProtocolPageShell";

/**
 * Onglet Recommandations — même panneau verre bleuté semi-transparent que « Mon protocole ».
 * Bords horizontaux et haut en pleine largeur pour les cartes métal (axes) ; padding texte via
 * `recommendationsReportHorizontalInsetClassName` sur les blocs qui en ont besoin.
 */
export const recommendationsReportShellClassName = cn(
  protocolPageBodyGlassClassName,
  "rounded-xl text-zinc-100",
  "px-0 pt-0 pb-8 sm:pb-10 md:pb-11",
);

/** Marge latérale pour textes / grilles qui ne doivent pas toucher le bord du verre. */
export const recommendationsReportHorizontalInsetClassName =
  "px-5 sm:px-8 md:px-11";
export const recommendationsReportTabsListClassName = cn(
  "inline-flex h-auto max-h-none min-h-[2.75rem] w-fit max-w-full flex-wrap justify-start gap-0.5",
  "rounded-lg border border-zinc-200 bg-zinc-100 p-1 text-zinc-700 sm:flex-nowrap",
);

export const recommendationsReportTabTriggerClassName = cn(
  "relative z-0 rounded-md border border-transparent px-3 py-2 text-left text-xs font-medium text-zinc-600 shadow-none",
  "hover:bg-white/70 hover:text-zinc-900",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "data-[state=active]:border-zinc-200 data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm",
  "data-[state=active]:[&_span.font-display]:text-zinc-800 data-[state=active]:[&_span.font-display]:opacity-100",
);
