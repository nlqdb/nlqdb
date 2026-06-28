import { describe, expect, it, vi } from "vitest";
import { resolveFrontierAskRouter } from "./frontier-router.ts";

// SK-FRONTIER-001 — the dormancy contract. With the shipped
// `HAS_FRONTIER_API_KEYS = false`, the apps/api wiring must return null
// before any env / KV / founder-key access, so /v1/ask is unchanged.
describe("resolveFrontierAskRouter — dormant while HAS_FRONTIER_API_KEYS=false", () => {
  it("returns null without reading KV or env keys", async () => {
    const kvGet = vi.fn();
    const kvPut = vi.fn();
    // A proxy env that throws if any frontier key is read — proves the gate
    // short-circuits before touching env at all.
    const env = new Proxy(
      { KV: { get: kvGet, put: kvPut } },
      {
        get(target, prop) {
          if (typeof prop === "string" && prop.startsWith("FRONTIER_")) {
            throw new Error(`env.${prop} must not be read while the frontier lane is dormant`);
          }
          return (target as Record<string, unknown>)[prop as string];
        },
      },
    ) as unknown as Cloudflare.Env;

    const router = await resolveFrontierAskRouter(env, "user", { e2e: false });

    expect(router).toBeNull();
    expect(kvGet).not.toHaveBeenCalled();
    expect(kvPut).not.toHaveBeenCalled();
  });
});
