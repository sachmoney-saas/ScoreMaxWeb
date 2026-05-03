import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
} from "@/lib/face-analysis-display";
import {
  describeCondition,
  type Condition,
  type ConditionDescribeContext,
} from "@/lib/recommendation-condition";
import type {
  RecommendationCategory,
  RecommendationEvidence,
  RecommendationRisk,
  RecommendationType,
} from "@/lib/recommendations";

/* Shared dark glassy panel used everywhere in the admin area. */
export const adminPanelClassName =
  "relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]";

export function AccessDenied() {
  return (
    <Card className={adminPanelClassName}>
      <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
        <ShieldAlert className="h-10 w-10 text-rose-300" />
        <p className="font-display text-xl font-semibold">Accès refusé</p>
        <p className="text-sm text-zinc-300">
          Cette section est réservée aux administrateurs.
        </p>
      </CardContent>
    </Card>
  );
}

export function PageHeader({
  eyebrow = "Administration · Recommandations",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 text-zinc-50">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-sm text-zinc-300 md:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "emerald" | "amber" | "sky" | "rose";
}) {
  const valueClass =
    accent === "emerald" ? "text-emerald-200"
    : accent === "amber"   ? "text-amber-200"
    : accent === "sky"     ? "text-sky-200"
    : accent === "rose"    ? "text-rose-200"
    : "text-white";
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </p>
      <p className={`font-display text-3xl font-bold tabular-nums tracking-tight ${valueClass}`}>
        {value}
        {hint ? <span className="ml-1 text-sm text-zinc-500">{hint}</span> : null}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- Badges */

const TYPE_BADGE: Record<RecommendationType, string> = {
  soft: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/20",
  hard: "bg-rose-400/15 text-rose-200 ring-rose-300/20",
};

export function TypeBadge({ type }: { type: RecommendationType }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset ${TYPE_BADGE[type]}`}
    >
      {type}
    </span>
  );
}

const RISK_BADGE: Record<RecommendationRisk, string> = {
  none:   "bg-emerald-400/12 text-emerald-200 ring-emerald-300/20",
  low:    "bg-lime-400/12 text-lime-200 ring-lime-300/20",
  medium: "bg-amber-400/15 text-amber-200 ring-amber-300/25",
  high:   "bg-rose-400/15 text-rose-200 ring-rose-300/25",
};

export function RiskBadge({ risk }: { risk: RecommendationRisk }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset ${RISK_BADGE[risk]}`}
    >
      {risk}
    </span>
  );
}

const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
  habit: "Habitude",
  exercise: "Exercice",
  topical: "Topique",
  nutrition: "Nutrition",
  device: "Accessoire",
  injectable: "Injectable",
  energy: "Énergie",
  surgery: "Chirurgie",
  device_clinical: "Appareil clinique",
  cosmetic: "Cosmétique",
};

export function CategoryBadge({ category }: { category: RecommendationCategory }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-zinc-300">
      {CATEGORY_LABEL[category]}
    </span>
  );
}

export const EVIDENCE_LABEL: Record<RecommendationEvidence, string> = {
  community: "Communauté",
  studies: "Études",
  medical: "Médical",
};

/* --------------------------------------------------------- Description */

/**
 * Returns a context object that the DSL describer can use to emit human
 * sentences with proper FR labels.
 */
export function buildDescribeContext(worker: string): ConditionDescribeContext {
  return {
    getKeyLabel: (key) => formatAggregateDisplayLabel(worker, key, "fr"),
    getEnumLabel: (key, value) => formatAggregateDisplayValue(worker, key, value, "fr"),
  };
}

export function describeConditionFor(
  worker: string,
  condition: Condition,
): string {
  return describeCondition(condition, buildDescribeContext(worker));
}
