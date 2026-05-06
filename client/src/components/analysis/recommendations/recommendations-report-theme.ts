import { cn } from "@/lib/utils";
import { scoreRingMatchBadgeBackgroundClassName } from "@/components/analysis/workers/_shared";

/**
 * Feuille onglet Recommandations — même base métal que « Mon protocole » /
 * `scoreRingMatchMetallicPillClassName`, étendue à toute la surface.
 */
export const recommendationsReportShellClassName = cn(
  "relative isolate mx-auto w-full max-w-5xl overflow-hidden rounded-xl",
  scoreRingMatchBadgeBackgroundClassName,
  "border border-white/40 ring-1 ring-slate-900/15",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_14px_rgba(71,85,105,0.2),0_14px_44px_-18px_rgba(0,0,0,0.48),0_6px_16px_-8px_rgba(0,0,0,0.22)]",
  "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit] before:bg-[linear-gradient(118deg,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.08)_38%,transparent_52%,rgba(15,23,42,0.06)_100%)] before:content-['']",
  "[&>*]:relative [&>*]:z-[1]",
  "px-5 py-8 text-zinc-900 sm:px-8 sm:py-10 md:px-11 md:py-11",
);
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
