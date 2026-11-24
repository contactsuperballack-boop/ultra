import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Integration tests hit a real (test) database sequentially — running
    // them in parallel would race on shared seed data / unique constraints.
    fileParallelism: false,
    testTimeout: 15_000,
    setupFiles: ["./tests/integration/setup.ts"],
  },
});
