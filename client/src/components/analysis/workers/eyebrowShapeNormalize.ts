/** Canonical brow shapes used in taxonomy + matrix arch signal. */

export type BrowShape =
  | "straight"
  | "soft_arch"
  | "high_arch"
  | "rounded";

const BROW_SHAPE_ALIASES: Record<string, BrowShape> = {
  straight: "straight",
  droit: "straight",
  flat: "straight",
  soft_arch: "soft_arch",
  "soft arch": "soft_arch",
  arched: "soft_arch",
  arc_doux: "soft_arch",
  high_arch: "high_arch",
  "high arch": "high_arch",
  arc_haut: "high_arch",
  rounded: "rounded",
  arrondi: "rounded",
  curved: "rounded",
};

export function normalizeBrowShape(value: string | null): BrowShape | null {
  if (!value) return null;
  const k = value.toLowerCase().trim().replace(/\s+/g, "_");
  return BROW_SHAPE_ALIASES[k] ?? null;
}

/** Synthetic 0–10 arch level for Bold×Feminine matrix (flat → high arch). */
export function eyebrowArchScoreForMatrix(shapeKey: BrowShape | null): number | null {
  if (!shapeKey) return null;
  if (shapeKey === "straight") return 1;
  if (shapeKey === "rounded") return 4;
  if (shapeKey === "soft_arch") return 6;
  if (shapeKey === "high_arch") return 9;
  return null;
}
