// `GET /v1/models` + catalog↔provider-allowlist consistency (SK-PREMIUM-013 /
// SK-PREMIUM-015). The endpoint is public (the picker renders before sign-in,
// GLOBAL-007) and is built live from models.dev with the bundled snapshot as
// fallback — in tests the outbound fetch is unavailable, so the endpoint serves
// the snapshot. Every catalog provider MUST be one the `x-nlq-byollm-key` /
// account lanes accept — otherwise the picker offers a model that 400s the
// moment a key is added. This test is the bridge that keeps the `@nlqdb/llm`
// catalog and the apps/api provider allowlist from drifting.

import { SELF } from "cloudflare:test";
import { MODEL_CATALOG, type ModelCatalog } from "@nlqdb/llm";
import { describe, expect, it } from "vitest";
import { SUPPORTED_BYOLLM_PROVIDERS } from "../src/ask/byollm.ts";

describe("GET /v1/models (SK-PREMIUM-013)", () => {
  it("serves the catalog unauthenticated", async () => {
    const res = await SELF.fetch("https://example.com/v1/models");
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModelCatalog;
    expect(body.presets.map((p) => p.id)).toEqual(["auto", "fast", "best"]);
    expect(body.free.label.length).toBeGreaterThan(0);
    expect(body.providers.length).toBeGreaterThanOrEqual(1);
  });

  it("every catalog provider is in the supported BYOLLM allowlist", () => {
    const supported = new Set<string>(SUPPORTED_BYOLLM_PROVIDERS);
    for (const p of MODEL_CATALOG.providers) {
      expect(supported.has(p.provider), `provider "${p.provider}"`).toBe(true);
    }
  });
});
