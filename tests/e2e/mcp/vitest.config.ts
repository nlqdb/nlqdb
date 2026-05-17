import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "e2e-mcp",
    include: ["**/*.test.ts"],
    fileParallelism: true,
    testTimeout: 15_000,
    globals: false,
  },
});
