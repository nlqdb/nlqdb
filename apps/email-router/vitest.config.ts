import { defineConfig } from "vitest/config";

// The handler takes a ForwardableEmailMessage and calls forward() on it,
// so a stub message covers every branch in node — Miniflare would add
// startup cost without adding coverage.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
