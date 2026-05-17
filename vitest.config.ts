import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "client/src/lib/face-capture/**/*.test.ts",
      "client/src/lib/onboarding-resume.test.ts",
      "client/src/lib/onboarding-flow-storage.test.ts",
      "client/src/lib/onboarding-post-capture.test.ts",
      "client/src/lib/capture-flow-config.test.ts",
      "client/src/lib/user-access.test.ts",
      "server/lib/onboarding-potential-image-policy.test.ts",
    ],
    environment: "node",
  },
});
