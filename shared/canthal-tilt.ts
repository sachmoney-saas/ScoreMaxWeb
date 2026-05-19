export const CANTHAL_TILT_NEUTRAL_DEADBAND_DEG = 0.5;

export type CanthalTiltCategory = "positive" | "neutral" | "negative";

export const CANTHAL_TILT_AGGREGATE_KEY = "morphology_and_tilt.canthal_tilt";
export const CANTHAL_TILT_ARGUMENT_KEY = `${CANTHAL_TILT_AGGREGATE_KEY}.argument`;

/**
 * Convention ScoreMax : angle signé autour de l'horizontale.
 * Positif quand le canthus latéral est plus haut que le canthus médial.
 */
export function canthalTiltCategoryFromMeanDegrees(
  meanDeg: number,
): CanthalTiltCategory | null {
  if (!Number.isFinite(meanDeg)) return null;
  if (meanDeg > CANTHAL_TILT_NEUTRAL_DEADBAND_DEG) return "positive";
  if (meanDeg < -CANTHAL_TILT_NEUTRAL_DEADBAND_DEG) return "negative";
  return "neutral";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function applyLocalCanthalTiltToAggregates(
  aggregates: Record<string, unknown>,
  meanDeg: number | null | undefined,
): Record<string, unknown> {
  if (meanDeg === null || meanDeg === undefined) return aggregates;
  const category = canthalTiltCategoryFromMeanDegrees(meanDeg);
  if (!category) return aggregates;

  const next: Record<string, unknown> = {
    ...aggregates,
    [CANTHAL_TILT_AGGREGATE_KEY]: category,
  };
  delete next[CANTHAL_TILT_ARGUMENT_KEY];

  const morphology = isRecord(next.morphology_and_tilt)
    ? { ...next.morphology_and_tilt }
    : {};
  const previousTilt = morphology.canthal_tilt;
  if (isRecord(previousTilt)) {
    const tilt: Record<string, unknown> = {
      ...previousTilt,
      value: category,
      category,
    };
    delete tilt.argument;
    morphology.canthal_tilt = tilt;
  } else {
    morphology.canthal_tilt = category;
  }
  next.morphology_and_tilt = morphology;

  return next;
}
