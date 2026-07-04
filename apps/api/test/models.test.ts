// `GET /v1/models` + catalog↔provider-allowlist consistency (SK-PREMIUM-013).
// The endpoint is public (the picker renders before sign-in, GLOBAL-007), and
// every BYOLLM entry's provider MUST be one the `x-nlq-byollm-key` / account
// lanes actually accept — otherwise the picker offers a model that 400s the
// moment a key is added. This test is the bridge that keeps the `@nlqdb/llm`
// catalog and the apps/api provider allowlist from drifting.

import { SELF } from "cloudflare:test";
import { MODEL_CATALOG } from "@nlqdb/llm";
import { describe, expect, it } from "vitest";
import { SUPPORTED_BYOLLM_PROVIDERS } from "../src/ask/byollm.ts";

describe("GET /v1/models (SK-PREMIUM-013)", () => {
  it("serves the catalog unauthenticated", async () => {
    const res = await SELF.fetch("https://example.com/v1/models");
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MODEL_CATALOG;
    expect(body.presets.map((p) => p.id)).toEqual(["auto", "fast", "best"]);
    expect(body.models.some((m) => m.id === "free")).toBe(true);
  });

  it("every catalog BYOLLM provider is in the supported allowlist", () => {
    const supported = new Set<string>(SUPPORTED_BYOLLM_PROVIDERS);
    for (const m of MODEL_CATALOG.models) {
      if (m.lane !== "byollm") continue;
      expect(supported.has(m.provider ?? ""), `${m.id} provider "${m.provider}"`).toBe(true);
    }
  });
});
