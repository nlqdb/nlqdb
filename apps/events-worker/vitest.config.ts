import { defineConfig } from "vitest/config";

// Two-project split mirrors apps/api: unit tests run in node (fast),
// integration runs in Miniflare (slow). For now the consumer is small
// enough that pure-node unit tests cover everything — Miniflare-backed
// queue tests can land when there's a behavior they're needed for.
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/queue.test.ts", "test/logsnag.test.ts"],
        },
      },
    ],
  },
});
