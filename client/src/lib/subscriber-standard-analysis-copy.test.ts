import { describe, expect, it } from "vitest";

import {
  formatSubscriberProtocolNextAnalysisLine,
  subscriberStandardCooldownParts,
} from "./subscriber-standard-analysis-copy";

describe("subscriber standard analysis copy", () => {
  it("formats protocol countdown with days and hours above one day", () => {
    expect(
      formatSubscriberProtocolNextAnalysisLine("fr", {
        days: 3,
        hours: 7,
        minutes: 42,
      }),
    ).toBe("Prochaine analyse dans 3 jours 7 h");
  });

  it("formats protocol countdown with hours and minutes below one day", () => {
    expect(
      formatSubscriberProtocolNextAnalysisLine("fr", {
        days: 0,
        hours: 6,
        minutes: 15,
      }),
    ).toBe("Prochaine analyse dans 6 h 15 min");
  });

  it("derives remaining whole days, hours and minutes from next availability", () => {
    const now = Date.UTC(2026, 4, 19, 8, 0, 0);
    const next = new Date(now + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 + 12 * 60 * 1000);

    expect(subscriberStandardCooldownParts(next.toISOString(), now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 12,
    });
  });
});
