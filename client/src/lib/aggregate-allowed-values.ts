/**
 * Static registry of accepted enum values per worker.aggregate, sourced from
 * docs/face-analysis/<worker>.md (the "Output possibles renvoyés" section).
 *
 * Why a registry instead of reading face-analysis-display.commonEnumLabels?
 *   commonEnumLabels is a *display* dictionary shared by ALL enums and
 *   contains every label ever rendered. It is not a per-aggregate spec.
 *
 * This file is the source of truth used by:
 *   - the admin metrics catalog (show realistic values per field)
 *   - the admin condition builder (multi-select picker for enum_in)
 *   - condition validation (warn when an unknown value is used)
 *
 * As we open new workers to recommendations, add their enums here.
 */

export type AggregateValueRegistry = Record<
  string,
  Record<string, readonly string[]>
>;

export const AGGREGATE_VALUE_REGISTRY: AggregateValueRegistry = {
  eyes: {
    "morphology_and_tilt.eye_shape": [
      "almond",
      "round",
      "hooded",
      "downturned",
    ],
    "morphology_and_tilt.canthal_tilt": ["negative", "neutral", "positive"],
    "eyelids_and_sclera.epicanthic_fold": ["present", "absent"],
    "details_and_color.limbal_ring_visibility": [
      "absent",
      "faint",
      "prominent",
    ],
    "details_and_color.iris_color": [
      "light_blue",
      "dark_blue",
      "grey_blue",
      "pure_grey",
      "light_green",
      "dark_green",
      "hazel_green",
      "hazel_brown",
      "light_brown",
      "medium_brown",
      "dark_brown",
      "amber",
      "almost_black",
      "central_heterochromia",
      "sectoral_heterochromia",
    ],
  },

  eye_brows: {
    "geometry_and_tilt.eyebrow_tilt": ["negative", "neutral", "positive"],
    "geometry_and_tilt.eyebrow_shape": [
      "straight",
      "soft_arch",
      "high_arch",
      "rounded",
    ],
    "geometry_and_tilt.inner_start_shape": ["squared", "rounded", "faded"],
    "thickness_and_density.hair_color": [
      "light_blonde",
      "dark_blonde",
      "red",
      "light_brown",
      "dark_brown",
      "black",
      "grey",
    ],
  },
};

/**
 * Returns the canonical enum values for a given worker.aggregate key, or null
 * if the field is not registered (i.e. unknown / not yet documented).
 */
export function getAllowedEnumValues(
  worker: string,
  key: string,
): readonly string[] | null {
  return AGGREGATE_VALUE_REGISTRY[worker]?.[key] ?? null;
}

/**
 * Lists every aggregate key that has a registered enum vocabulary for the
 * given worker. Useful for the admin overview.
 */
export function listRegisteredEnumKeys(worker: string): string[] {
  return Object.keys(AGGREGATE_VALUE_REGISTRY[worker] ?? {});
}
