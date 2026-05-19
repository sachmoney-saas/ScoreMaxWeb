import { cn } from "@/lib/utils";

/**
 * Pastilles gradient bleu / rouge (filtre reco Softmaxxing·Hardmaxxing).
 * Soft : cobalt / bleu roi + reflet façon capsule.
 */
export const softmaxxingGradientPillClassName = cn(
  "relative z-0 overflow-hidden border border-blue-400/50 ring-1 ring-slate-950/35",
  "bg-[linear-gradient(to_top_right,#172554_0%,#1d4ed8_20%,#3b82f6_38%,#bfdbfe_54%,#2563eb_78%,#172554_100%)]",
  "font-semibold text-blue-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.52),inset_0_-2px_12px_rgba(30,64,175,0.45)]",
  "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit] before:bg-[linear-gradient(118deg,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.08)_38%,transparent_52%,rgba(30,58,138,0.16)_100%)] before:content-['']",
);

export const hardmaxxingGradientPillClassName = cn(
  "relative z-0 overflow-hidden border border-rose-400/55 ring-1 ring-rose-950/35",
  "bg-[linear-gradient(to_top_right,#881337_0%,#dc2626_22%,#fb7185_42%,#ffe4e6_56%,#e11d48_78%,#9f1239_100%)]",
  "font-semibold text-rose-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.48),inset_0_-2px_12px_rgba(127,29,29,0.4)]",
  "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit] before:bg-[linear-gradient(118deg,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0.07)_38%,transparent_52%,rgba(69,10,22,0.18)_100%)] before:content-['']",
);
