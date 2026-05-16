import { describe, expect, it } from "vitest";
import { resolveUserAccess } from "./user-access";

const base = {
  isLoading: false,
  userId: "user-1",
  hasCompletedOnboarding: true,
  hasEverSubscribed: false,
  hasPremiumAccess: false,
  isAdmin: false,
};

describe("resolveUserAccess", () => {
  it("routes new users to onboarding capture", () => {
    const access = resolveUserAccess({
      ...base,
      hasCompletedOnboarding: false,
    });
    expect(access.kind).toBe("needs_onboarding_capture");
    expect(access.shouldUseOnboardingFlow).toBe(true);
    expect(access.canAccessApp).toBe(false);
    expect(access.postLoginPath).toBe("/onboarding");
  });

  it("keeps never-subscribed users in onboarding funnel", () => {
    const access = resolveUserAccess({ ...base });
    expect(access.kind).toBe("onboarding_paywall_funnel");
    expect(access.shouldUseOnboardingFlow).toBe(true);
    expect(access.canAccessApp).toBe(false);
  });

  it("sends lapsed subscribers to the app in read-only mode", () => {
    const access = resolveUserAccess({
      ...base,
      hasEverSubscribed: true,
    });
    expect(access.kind).toBe("lapsed_subscriber");
    expect(access.canAccessApp).toBe(true);
    expect(access.canLaunchNewAnalyses).toBe(false);
    expect(access.shouldUseOnboardingFlow).toBe(false);
    expect(access.postLoginPath).toBe("/app");
  });

  it("grants full access to active subscribers", () => {
    const access = resolveUserAccess({
      ...base,
      hasPremiumAccess: true,
    });
    expect(access.kind).toBe("premium");
    expect(access.canLaunchNewAnalyses).toBe(true);
    expect(access.postLoginPath).toBe("/app");
  });
});
