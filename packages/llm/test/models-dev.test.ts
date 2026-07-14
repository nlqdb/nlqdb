// SK-PREMIUM-015 — the models.dev → catalog mapper. Pins the filter, sort, and
// slug-mapping rules that keep the frontier picker current, correct, and
// dispatchable, plus the per-provider snapshot fallback.

import { describe, expect, it } from "vitest";
import { MODEL_CATALOG } from "../src/catalog.ts";
import { buildCatalogFromModelsDev, type ModelsDevApi } from "../src/models-dev.ts";

const text = { output: ["text"] };

const RAW: ModelsDevApi = {
  anthropic: {
    models: {
      a1: {
        id: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        release_date: "2026-06-29",
        tool_call: true,
        modalities: text,
      },
      a2: {
        id: "claude-opus-4-8",
        name: "Claude Opus 4.8",
        release_date: "2026-05-28",
        tool_call: true,
        modalities: text,
      },
      // Dropped: no tool calling.
      aNoTool: {
        id: "claude-chat-lite",
        name: "no tools",
        release_date: "2026-07-01",
        tool_call: false,
        modalities: text,
      },
      // Dropped from a lab row: open weights belong to the free chain.
      aOpenWeights: {
        id: "claude-ow",
        name: "open weights",
        release_date: "2026-07-02",
        tool_call: true,
        open_weights: true,
        modalities: text,
      },
    },
  },
  openai: {
    models: {
      o1: {
        id: "gpt-5.6",
        name: "GPT-5.6",
        release_date: "2026-07-09",
        tool_call: true,
        modalities: text,
      },
    },
  },
  // models.dev names Gemini `google`; we surface it as `google-ai-studio`.
  google: {
    models: {
      g1: {
        id: "gemini-3.5-flash",
        name: "Gemini 3.5 Flash",
        release_date: "2026-05-19",
        tool_call: true,
        modalities: text,
      },
    },
  },
  // models.dev names xAI `xai`; we dispatch it as `grok`.
  xai: {
    models: {
      x1: {
        id: "grok-4.5",
        name: "Grok 4.5",
        release_date: "2026-07-08",
        tool_call: true,
        modalities: text,
      },
    },
  },
  openrouter: {
    models: {
      r1: {
        id: "openai/gpt-5.6",
        name: "GPT-5.6",
        release_date: "2026-07-09",
        tool_call: true,
        modalities: text,
      },
      // Kept for OpenRouter — open weights are its whole point.
      r2: {
        id: "deepseek/deepseek-v4",
        name: "DeepSeek V4",
        release_date: "2026-07-05",
        tool_call: true,
        open_weights: true,
        modalities: text,
      },
      // Dropped: a `:` variant suffix can't round-trip the header format.
      rColon: {
        id: "meta/llama-3.1:free",
        name: "Llama free",
        release_date: "2026-07-10",
        tool_call: true,
        modalities: text,
      },
    },
  },
};

describe("buildCatalogFromModelsDev (SK-PREMIUM-015)", () => {
  const catalog = buildCatalogFromModelsDev(RAW);
  const byId = new Map(catalog.providers.map((p) => [p.provider, p]));

  it("keeps presets and the free row static", () => {
    expect(catalog.presets.map((p) => p.id)).toEqual(["auto", "fast", "best"]);
    expect(catalog.free.label.length).toBeGreaterThan(0);
  });

  it("emits the five provider rows in display order", () => {
    expect(catalog.providers.map((p) => p.provider)).toEqual([
      "anthropic",
      "openai",
      "google-ai-studio",
      "grok",
      "openrouter",
    ]);
  });

  it("filters non-tool + open-weights models on lab rows, newest first", () => {
    const anthropic = byId.get("anthropic");
    expect(anthropic?.models.map((m) => m.model)).toEqual(["claude-sonnet-5", "claude-opus-4-8"]);
    expect(anthropic?.defaultModel).toBe("claude-sonnet-5");
    expect(anthropic?.models[0]?.id).toBe("anthropic:claude-sonnet-5");
  });

  it("maps the vendor slugs (xai→grok, google→google-ai-studio)", () => {
    expect(byId.get("grok")?.models[0]?.model).toBe("grok-4.5");
    expect(byId.get("grok")?.models[0]?.id).toBe("grok:grok-4.5");
    expect(byId.get("google-ai-studio")?.models[0]?.model).toBe("gemini-3.5-flash");
  });

  it("keeps open-weights on OpenRouter but drops `:` variant ids", () => {
    const or = byId.get("openrouter");
    expect(or?.models.map((m) => m.model)).toEqual(["openai/gpt-5.6", "deepseek/deepseek-v4"]);
    expect(or?.models.map((m) => m.id)).toContain("openrouter:openai/gpt-5.6");
  });

  it("falls back to the snapshot row for a provider models.dev omits", () => {
    const { openai: _drop, ...withoutOpenai } = RAW;
    const fallback = buildCatalogFromModelsDev(withoutOpenai);
    const snapshotOpenai = MODEL_CATALOG.providers.find((p) => p.provider === "openai");
    const builtOpenai = fallback.providers.find((p) => p.provider === "openai");
    expect(builtOpenai).toEqual(snapshotOpenai);
  });
});
