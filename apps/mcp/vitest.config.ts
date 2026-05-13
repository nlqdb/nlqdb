import { defineConfig } from "vitest/config";

// Unit tests run in node (fast). Miniflare-backed integration tests can
// land when slice 3b adds the Durable Object session layer — until then
// the Worker is pure protocol shim and unit-testable against the
// default-exported `fetch` handler.
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/bearer-gate.test.ts"],
        },
      },
    ],
  },
});
