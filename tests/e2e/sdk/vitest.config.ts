import { defineConfig } from "vitest/config";

// Per-test isolation, with the project name surfaced in CI logs so a
// failing persona test points at the matrix cell that owns it.
export default defineConfig({
  test: {
    name: "e2e-sdk",
    include: ["**/*.test.ts"],
    // Cassette replay is in-process — no parallel network races to
    // worry about, but we still run files in parallel for speed.
    fileParallelism: true,
    testTimeout: 15_000,
    globals: false,
  },
});
