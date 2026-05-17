import { describe, expect, it } from "vitest";

import {
  buildDayPlan,
  dayOffsetToCode,
  filterStepsForDay,
  stepMatchesWeekday,
} from "./protocol-day";
import type { ActivePreset, PresetStep } from "@shared/protocol-presets";

const monday = new Date(2026, 4, 18); // 2026-05-18 is a Monday

function makeStep(
  partial: Partial<PresetStep> & Pick<PresetStep, "slot" | "weekday_pattern" | "position" | "title_en">,
): PresetStep {
  return {
    id: partial.id ?? `step-${partial.position}`,
    preset_id: "skin_v1",
    title_fr: partial.title_en,
    detail_en: null,
    detail_fr: null,
    ...partial,
  };
}

const skinPreset: ActivePreset = {
  routine: {
    id: "r1",
    user_id: "u1",
    preset_id: "skin_v1",
    started_at: monday.toISOString(),
    removed_at: null,
  },
  preset: {
    id: "skin_v1",
    slug: "skin",
    target_worker: "skin",
    title_en: "Skin",
    title_fr: "Peau",
    summary_en: "",
    summary_fr: "",
    priority: 10,
    enabled: true,
  },
  steps: [
    makeStep({
      slot: "evening",
      weekday_pattern: ["mon", "thu"],
      position: 2,
      title_en: "BHA",
    }),
    makeStep({
      slot: "evening",
      weekday_pattern: ["tue", "fri"],
      position: 2,
      title_en: "AHA",
    }),
    makeStep({
      slot: "evening",
      weekday_pattern: ["wed", "sat", "sun"],
      position: 2,
      title_en: "Recovery",
    }),
  ],
  alwaysOn: [],
  avoid: [],
};

describe("dayOffsetToCode", () => {
  it("returns mon for offset 0 on a Monday", () => {
    expect(dayOffsetToCode(0, monday)).toBe("mon");
  });

  it("returns tue for offset 1 on a Monday", () => {
    expect(dayOffsetToCode(1, monday)).toBe("tue");
  });
});

describe("stepMatchesWeekday", () => {
  it("matches all days when pattern is all", () => {
    expect(stepMatchesWeekday(["all"], "wed")).toBe(true);
  });

  it("matches only listed weekdays", () => {
    expect(stepMatchesWeekday(["mon", "thu"], "mon")).toBe(true);
    expect(stepMatchesWeekday(["mon", "thu"], "tue")).toBe(false);
  });
});

describe("filterStepsForDay", () => {
  it("returns BHA steps on Monday evening", () => {
    const evening = filterStepsForDay(skinPreset.steps, "mon", "evening");
    expect(evening.map((s) => s.title_en)).toEqual(["BHA"]);
  });

  it("returns AHA steps on Tuesday evening", () => {
    const evening = filterStepsForDay(skinPreset.steps, "tue", "evening");
    expect(evening.map((s) => s.title_en)).toEqual(["AHA"]);
  });

  it("returns recovery on Wednesday evening", () => {
    const evening = filterStepsForDay(skinPreset.steps, "wed", "evening");
    expect(evening.map((s) => s.title_en)).toEqual(["Recovery"]);
  });
});

describe("buildDayPlan", () => {
  it("assigns evening steps per weekday offset from Monday", () => {
    const mon = buildDayPlan([skinPreset], 0, "en", monday);
    expect(mon.evening[0]?.title).toBe("BHA");

    const tue = buildDayPlan([skinPreset], 1, "en", monday);
    expect(tue.evening[0]?.title).toBe("AHA");

    const wed = buildDayPlan([skinPreset], 2, "en", monday);
    expect(wed.evening[0]?.title).toBe("Recovery");
  });
});
