import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["client/src/lib/face-capture/**/*.test.ts"],
    environment: "node",
  },
});
