import {
  AlertTriangle,
  Circle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Crown,
  Star,
  Gem,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ScoreRank = {
  index: number;
  title: string;
  pslLabel: string;
  Icon: LucideIcon;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeRing: string;
};

export const SCORE_TIERS: {
  maxExclusive: number;
  title: string;
  pslLabel: string;
  /** Short name for progress blurbs (below global score); not PSL. */
  progressName: { fr: string; en: string };
  Icon: LucideIcon;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeRing: string;
}[] = [
  {
    maxExclusive: 25,
    title: "Sub-human Bottom Percentile",
    pslLabel: "PSL 1-2",
    progressName: { fr: "Bottom percentile", en: "Bottom percentile" },
    Icon: AlertTriangle,
    color: "#f87171",
    badgeBg: "bg-rose-400/15",
    badgeText: "text-rose-200",
    badgeRing: "ring-rose-400/30",
  },
  {
    maxExclusive: 35,
    title: "Sub-5 / Low-Tier Sub-Normie",
    pslLabel: "PSL 3",
    progressName: { fr: "Below-normie tier", en: "Below-normie tier" },
    Icon: AlertTriangle,
    color: "#fb923c",
    badgeBg: "bg-orange-400/15",
    badgeText: "text-orange-200",
    badgeRing: "ring-orange-400/30",
  },
  {
    maxExclusive: 45,
    title: "LTN (Low-Tier Normie) / Invisible",
    pslLabel: "PSL 4",
    progressName: { fr: "Low-tier normie", en: "Low-tier normie" },
    Icon: Circle,
    color: "#fbbf24",
    badgeBg: "bg-amber-400/15",
    badgeText: "text-amber-200",
    badgeRing: "ring-amber-400/30",
  },
  {
    maxExclusive: 55,
    title: "Mid-Tier Normie / Ultimate NPC",
    pslLabel: "PSL 4.5",
    progressName: { fr: "Mid-tier normie", en: "Mid-tier normie" },
    Icon: Circle,
    color: "#facc15",
    badgeBg: "bg-yellow-400/15",
    badgeText: "text-yellow-200",
    badgeRing: "ring-yellow-400/30",
  },
  {
    maxExclusive: 60,
    title: "True Normie / Baseline",
    pslLabel: "PSL 5",
    progressName: { fr: "True Normie", en: "True Normie" },
    Icon: CheckCircle2,
    color: "#34d399",
    badgeBg: "bg-emerald-400/15",
    badgeText: "text-emerald-200",
    badgeRing: "ring-emerald-400/30",
  },
  {
    maxExclusive: 70,
    title: "HTN (High-Tier Normie) / Local Chad",
    pslLabel: "PSL 5.5",
    progressName: { fr: "High-tier normie", en: "High-tier normie" },
    Icon: TrendingUp,
    color: "#22d3ee",
    badgeBg: "bg-cyan-400/15",
    badgeText: "text-cyan-200",
    badgeRing: "ring-cyan-400/30",
  },
  {
    maxExclusive: 80,
    title: "Chadlite / Stacylite / Mogger",
    pslLabel: "PSL 6",
    progressName: { fr: "Chadlite", en: "Chadlite" },
    Icon: Star,
    color: "#60a5fa",
    badgeBg: "bg-sky-400/15",
    badgeText: "text-sky-200",
    badgeRing: "ring-sky-400/30",
  },
  {
    maxExclusive: 85,
    title: "Model-Tier Chad",
    pslLabel: "PSL 7",
    progressName: { fr: "Model-tier look", en: "Model-tier look" },
    Icon: Gem,
    color: "#a78bfa",
    badgeBg: "bg-violet-400/15",
    badgeText: "text-violet-200",
    badgeRing: "ring-violet-400/30",
  },
  {
    maxExclusive: 95,
    title: "Genetic Freak Gigachad PSL God",
    pslLabel: "PSL 8",
    progressName: {
      fr: "Top genetics tier",
      en: "Top genetics tier",
    },
    Icon: Sparkles,
    color: "#e9f1f4",
    badgeBg: "bg-zinc-200/15",
    badgeText: "text-zinc-100",
    badgeRing: "ring-zinc-200/30",
  },
  {
    maxExclusive: Infinity,
    title: "Alien Tier Ascended",
    pslLabel: "PSL 9+",
    progressName: { fr: "Alien tier", en: "Alien tier" },
    Icon: Crown,
    color: "#fbbf24",
    badgeBg: "bg-amber-300/15",
    badgeText: "text-amber-100",
    badgeRing: "ring-amber-300/40",
  },
];

export function getScoreRank(score: number): ScoreRank {
  for (let i = 0; i < SCORE_TIERS.length; i++) {
    if (score < SCORE_TIERS[i].maxExclusive) {
      return {
        index: i,
        title: SCORE_TIERS[i].title,
        pslLabel: SCORE_TIERS[i].pslLabel,
        Icon: SCORE_TIERS[i].Icon,
        color: SCORE_TIERS[i].color,
        badgeBg: SCORE_TIERS[i].badgeBg,
        badgeText: SCORE_TIERS[i].badgeText,
        badgeRing: SCORE_TIERS[i].badgeRing,
      };
    }
  }
  const last = SCORE_TIERS[SCORE_TIERS.length - 1];
  return {
    index: SCORE_TIERS.length - 1,
    title: last.title,
    pslLabel: last.pslLabel,
    Icon: last.Icon,
    color: last.color,
    badgeBg: last.badgeBg,
    badgeText: last.badgeText,
    badgeRing: last.badgeRing,
  };
}

/** Map a per-metric score (0…`scale`) to the global 0–100 scale used for PSL tiers. */
export function localScoreToGlobal100(local: number, scale: number): number {
  if (scale <= 0) return 0;
  const c = Math.max(0, Math.min(local, scale));
  return (c / scale) * 100;
}

export type GlobalTierSegment = {
  lower: number;
  upper: number;
  widthFrac: number;
  pslLabel: string;
};

function buildGlobalTierSegments(): GlobalTierSegment[] {
  return SCORE_TIERS.map((tier, i) => {
    const lower = i === 0 ? 0 : SCORE_TIERS[i - 1].maxExclusive;
    const upper = tier.maxExclusive === Infinity ? 100 : tier.maxExclusive;
    return {
      lower,
      upper,
      widthFrac: (upper - lower) / 100,
      pslLabel: tier.pslLabel,
    };
  });
}

export const GLOBAL_TIER_SEGMENTS: GlobalTierSegment[] = buildGlobalTierSegments();
