import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

// Three projects, mirroring `apps/api/vitest.config.ts`:
//   unit                  — pure functions (oauth-bridge encode/decode). Runs
//                            in node. No `cloudflare:workers`-bound imports.
//   integration           — needs the Workers runtime (OAuthProvider +
//                            McpAgent). `cloudflareTest` resolves
//                            `cloudflare:workers` and `SELF.fetch` hits the
//                            real Worker entry point. BETTER_AUTH_SECRET set.
//   integration-no-secret — same runtime but BETTER_AUTH_SECRET deliberately
//                            unset, reproducing the prod misconfiguration that
//                            made GET /authorize throw a raw 1101 (2026-06-25).

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: [
            "test/oauth-bridge.test.ts",
            "test/oauth-observability.test.ts",
            "test/https-enforce.test.ts",
          ],
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
                // BETTER_AUTH_SECRET deliberately omitted.
              },
            },
          }),
        ],
        test: {
          name: "integration-no-secret",
          include: ["test/authorize-no-secret.test.ts"],
        },
      },
    ],
  },
});
