import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

// Two projects, mirroring `apps/api/vitest.config.ts`:
//   unit        — pure functions (oauth-bridge encode/decode). Runs in node.
//                 No imports of `cloudflare:workers`-bound code.
//   integration — needs the Workers runtime (OAuthProvider + McpAgent).
//                 Uses `cloudflareTest` so `cloudflare:workers` resolves
//                 and `SELF.fetch` hits the real Worker entry point.

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/oauth-bridge.test.ts", "test/oauth-observability.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [
          cloudflareTest({
            main: "./src/index.ts",
            singleWorker: true,
            isolatedStorage: true,
            wrangler: { configPath: path.join(here, "wrangler.toml") },
            miniflare: {
              bindings: {
                NODE_ENV: "test",
                NLQDB_WEB_ORIGIN: "https://app.nlqdb.test",
                NLQDB_API_BASE_URL: "https://app.nlqdb.test",
                BETTER_AUTH_SECRET: "test-better-auth-secret-do-not-use-in-prod",
              },
            },
          }),
        ],
        test: {
          name: "integration",
          include: ["test/bearer-gate.test.ts"],
        },
      },
    ],
  },
});
