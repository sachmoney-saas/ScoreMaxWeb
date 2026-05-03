/**
 * Recommendation matching DSL — pure helpers used by both runtime matching
 * (client/src/lib/recommendations.ts) and the admin condition builder
 * (client/src/components/admin/recommendations/ConditionBuilder.tsx).
 *
 * The DSL is intentionally narrow:
 *   - `score_lte` / `score_gte`   for numeric thresholds (0..10)
 *   - `enum_in`                   for string enum membership
 *   - `all`                       always-true escape hatch
 *   - `and` / `or`                composition
 *
 * For 99% of editorial rules a single AND/OR group of leaf rules is enough,
 * so the admin UI exposes a flat "rule list + combinator" view and falls back
 * to a JSON editor only when the saved condition is too complex to flatten.
 */

import type { Condition } from "@/lib/recommendations";

export type { Condition };

/* ============================================================================
 * Flat representation — used by the visual condition builder
 * ========================================================================= */

export type LeafRule =
  | { kind: "all" }
  | { kind: "score"; key: string; op: "lte" | "gte"; value: number }
  | { kind: "enum"; key: string; values: string[] };

export type FlatGroup = {
  combinator: "and" | "or";
  rules: LeafRule[];
};

/** Returns true when condition can be safely round-tripped through FlatGroup. */
export function isFlattenable(condition: Condition): boolean {
  if ("all" in condition) return true;
  if ("score_lte" in condition || "score_gte" in condition || "enum_in" in condition) {
    return true;
  }
  if ("and" in condition) {
    return condition.and.every(isLeaf);
  }
  if ("or" in condition) {
    return condition.or.every(isLeaf);
  }
  return false;
}

function isLeaf(condition: Condition): boolean {
  return (
    "all" in condition ||
    "score_lte" in condition ||
    "score_gte" in condition ||
    "enum_in" in condition
  );
}

function leafToRule(condition: Condition): LeafRule {
  if ("all" in condition) return { kind: "all" };
  if ("score_lte" in condition) {
    return { kind: "score", key: condition.score_lte.key, op: "lte", value: condition.score_lte.value };
  }
  if ("score_gte" in condition) {
    return { kind: "score", key: condition.score_gte.key, op: "gte", value: condition.score_gte.value };
  }
  if ("enum_in" in condition) {
    return { kind: "enum", key: condition.enum_in.key, values: [...condition.enum_in.values] };
  }
  // Should never happen: caller must check isFlattenable first.
  throw new Error("Cannot flatten composite condition");
}

/** Convert a Condition to a FlatGroup. Caller must check isFlattenable first. */
export function flattenCondition(condition: Condition): FlatGroup {
  if ("and" in condition) {
    return { combinator: "and", rules: condition.and.map(leafToRule) };
  }
  if ("or" in condition) {
    return { combinator: "or", rules: condition.or.map(leafToRule) };
  }
  // single leaf wraps into an `and` group
  return { combinator: "and", rules: [leafToRule(condition)] };
}

function ruleToCondition(rule: LeafRule): Condition {
  switch (rule.kind) {
    case "all":
      return { all: true };
    case "score":
      return rule.op === "lte"
        ? { score_lte: { key: rule.key, value: rule.value } }
        : { score_gte: { key: rule.key, value: rule.value } };
    case "enum":
      return { enum_in: { key: rule.key, values: rule.values } };
  }
}

/** Convert a FlatGroup back to a Condition. */
export function groupToCondition(group: FlatGroup): Condition {
  if (group.rules.length === 0) return { all: true };
  if (group.rules.length === 1) return ruleToCondition(group.rules[0]);
  const conds = group.rules.map(ruleToCondition);
  return group.combinator === "and" ? { and: conds } : { or: conds };
}

/* ============================================================================
 * Inspection — used by validation and by the metrics catalog ("recos
 * referencing this key")
 * ========================================================================= */

/** Returns every aggregate key referenced anywhere in the condition tree. */
export function extractReferencedKeys(condition: Condition): string[] {
  const out = new Set<string>();
  function walk(c: Condition): void {
    if ("all" in c) return;
    if ("score_lte" in c) { out.add(c.score_lte.key); return; }
    if ("score_gte" in c) { out.add(c.score_gte.key); return; }
    if ("enum_in" in c)   { out.add(c.enum_in.key);   return; }
    if ("and" in c) { c.and.forEach(walk); return; }
    if ("or"  in c) { c.or.forEach(walk);  return; }
  }
  walk(condition);
  return Array.from(out);
}

export type ConditionValidationIssue = {
  level: "error" | "warning";
  message: string;
  /** Key path inside the condition tree, e.g. "and[1].score_lte.key" */
  path?: string;
};

export type ConditionValidationResult = {
  valid: boolean;
  issues: ConditionValidationIssue[];
};

export type AllowedAggregate = {
  key: string;
  kind: "score" | "enum" | "number" | "boolean" | "text" | "list" | null;
  allowedValues?: string[];
};

/**
 * Static validation of a condition against a worker's known aggregates.
 *  - errors are fatal (unknown key, wrong kind, illegal enum value)
 *  - warnings are advisory (score out of [0..10], empty enum_in, ...)
 */
export function validateCondition(
  condition: Condition,
  allowed: AllowedAggregate[],
): ConditionValidationResult {
  const byKey = new Map<string, AllowedAggregate>();
  for (const a of allowed) byKey.set(a.key, a);

  const issues: ConditionValidationIssue[] = [];

  function check(c: Condition, path: string): void {
    if ("all" in c) return;

    if ("score_lte" in c || "score_gte" in c) {
      const isLte = "score_lte" in c;
      const leaf = isLte ? c.score_lte : c.score_gte;
      const meta = byKey.get(leaf.key);
      if (!meta) {
        issues.push({
          level: "error",
          path: `${path}.${isLte ? "score_lte" : "score_gte"}.key`,
          message: `La métrique "${leaf.key}" n'existe pas pour ce worker.`,
        });
        return;
      }
      if (meta.kind && meta.kind !== "score" && meta.kind !== "number") {
        issues.push({
          level: "error",
          path,
          message: `"${leaf.key}" est de type "${meta.kind}", pas un score numérique.`,
        });
      }
      if (typeof leaf.value !== "number" || Number.isNaN(leaf.value)) {
        issues.push({ level: "error", path, message: "La valeur seuil doit être un nombre." });
      } else if (leaf.value < 0 || leaf.value > 10) {
        issues.push({
          level: "warning",
          path,
          message: `Seuil ${leaf.value} hors plage [0..10] habituelle.`,
        });
      }
      return;
    }

    if ("enum_in" in c) {
      const meta = byKey.get(c.enum_in.key);
      if (!meta) {
        issues.push({
          level: "error",
          path: `${path}.enum_in.key`,
          message: `La métrique "${c.enum_in.key}" n'existe pas pour ce worker.`,
        });
        return;
      }
      if (meta.kind && meta.kind !== "enum") {
        issues.push({
          level: "error",
          path,
          message: `"${c.enum_in.key}" est de type "${meta.kind}", pas un enum.`,
        });
        return;
      }
      if (c.enum_in.values.length === 0) {
        issues.push({
          level: "warning",
          path,
          message: "Aucune valeur sélectionnée — la règle ne matchera jamais.",
        });
      }
      if (meta.allowedValues && meta.allowedValues.length > 0) {
        const allowedSet = new Set(meta.allowedValues);
        const unknown = c.enum_in.values.filter((v) => !allowedSet.has(v));
        if (unknown.length > 0) {
          issues.push({
            level: "warning",
            path,
            message: `Valeurs hors registre : ${unknown.join(", ")}.`,
          });
        }
      }
      return;
    }

    if ("and" in c) {
      if (c.and.length === 0) {
        issues.push({ level: "warning", path, message: "Groupe AND vide." });
      }
      c.and.forEach((sub, i) => check(sub, `${path}.and[${i}]`));
      return;
    }

    if ("or" in c) {
      if (c.or.length === 0) {
        issues.push({ level: "warning", path, message: "Groupe OR vide." });
      }
      c.or.forEach((sub, i) => check(sub, `${path}.or[${i}]`));
      return;
    }
  }

  check(condition, "$");

  return {
    valid: issues.every((i) => i.level !== "error"),
    issues,
  };
}

/* ============================================================================
 * Pretty-printing — used in tables & previews to explain rules in French
 * ========================================================================= */

export type ConditionDescribeContext = {
  /** Returns the human label for an aggregate key (e.g. "Support sous les yeux"). */
  getKeyLabel: (key: string) => string;
  /** Returns the human label for an enum value (e.g. "Tombants"). */
  getEnumLabel: (key: string, value: string) => string;
};

export function describeCondition(
  condition: Condition,
  ctx: ConditionDescribeContext,
): string {
  if ("all" in condition) return "Toujours pertinente";

  if ("score_lte" in condition) {
    return `${ctx.getKeyLabel(condition.score_lte.key)} ≤ ${condition.score_lte.value}`;
  }
  if ("score_gte" in condition) {
    return `${ctx.getKeyLabel(condition.score_gte.key)} ≥ ${condition.score_gte.value}`;
  }
  if ("enum_in" in condition) {
    const values = condition.enum_in.values
      .map((v) => `« ${ctx.getEnumLabel(condition.enum_in.key, v)} »`)
      .join(" ou ");
    return `${ctx.getKeyLabel(condition.enum_in.key)} est ${values}`;
  }

  const join = (conds: Condition[], sep: string) =>
    conds.map((c) => describeCondition(c, ctx)).join(sep);

  if ("and" in condition) return join(condition.and, " ET ");
  if ("or"  in condition) return join(condition.or,  " OU ");
  return "—";
}

/** Compact one-liner for table cells (uses raw keys, no labels). */
export function summarizeCondition(condition: Condition): string {
  if ("all" in condition) return "Toujours";
  if ("score_lte" in condition) return `${condition.score_lte.key} ≤ ${condition.score_lte.value}`;
  if ("score_gte" in condition) return `${condition.score_gte.key} ≥ ${condition.score_gte.value}`;
  if ("enum_in" in condition) {
    return `${condition.enum_in.key} ∈ {${condition.enum_in.values.join(", ")}}`;
  }
  if ("and" in condition) return condition.and.map(summarizeCondition).join(" ET ");
  if ("or"  in condition) return condition.or.map(summarizeCondition).join(" OU ");
  return "—";
}
