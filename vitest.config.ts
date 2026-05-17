import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    include: [
      "client/src/lib/face-capture/**/*.test.ts",
      "client/src/lib/onboarding-resume.test.ts",
      "client/src/lib/onboarding-flow-storage.test.ts",
      "client/src/lib/onboarding-post-capture.test.ts",
      "client/src/lib/capture-flow-config.test.ts",
      "client/src/lib/user-access.test.ts",
      "client/src/lib/protocol-day.test.ts",
      "server/lib/onboarding-potential-image-policy.test.ts",
    ],
    environment: "node",
  },
});
