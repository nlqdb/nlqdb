import { defineConfig } from "vitest/config";

// Two projects so the bundle stays DOM-dep-free for pure-function
// tests (`render`, `templates`, `fetch`, `action-goal`, `action-render`,
// `parse`) and only the element-class integration tests pay the
// happy-dom cost. The bundle published to the CDN is unaffected —
// happy-dom is a devDependency.

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "test/fetch.test.ts",
            "test/parse.test.ts",
            "test/render.test.ts",
            "test/templates.test.ts",
            "test/action-goal.test.ts",
            "test/action-render.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["test/action-element.test.ts"],
        },
      },
    ],
  },
});
