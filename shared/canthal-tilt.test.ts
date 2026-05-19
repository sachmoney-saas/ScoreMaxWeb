import { describe, expect, it } from "vitest";
import {
  applyLocalCanthalTiltToAggregates,
  canthalTiltCategoryFromMeanDegrees,
  CANTHAL_TILT_AGGREGATE_KEY,
  CANTHAL_TILT_ARGUMENT_KEY,
} from "./canthal-tilt";

describe("canthal tilt local aggregate helpers", () => {
  it("classifies lateral-canthus-up geometry as positive", () => {
    expect(canthalTiltCategoryFromMeanDegrees(2.8)).toBe("positive");
    expect(canthalTiltCategoryFromMeanDegrees(-2.8)).toBe("negative");
    expect(canthalTiltCategoryFromMeanDegrees(0.4)).toBe("neutral");
  });

  it("overrides stale worker output with the local geometry category", () => {
    const aggregates = applyLocalCanthalTiltToAggregates(
      {
        [CANTHAL_TILT_AGGREGATE_KEY]: "negative",
        [CANTHAL_TILT_ARGUMENT_KEY]: "Stale model wording.",
        morphology_and_tilt: {
          canthal_tilt: {
            value: "negative",
            argument: "Stale nested wording.",
          },
        },
      },
      3,
    );

    expect(aggregates[CANTHAL_TILT_AGGREGATE_KEY]).toBe("positive");
    expect(aggregates[CANTHAL_TILT_ARGUMENT_KEY]).toBeUndefined();
    expect(aggregates.morphology_and_tilt).toEqual({
      canthal_tilt: {
        value: "positive",
        category: "positive",
      },
    });
  });
});
