import { describe, expect, it, vi } from "vitest";
import {
  type FrontierEligibilityCtx,
  isFrontierEligible,
} from "../src/frontier/eligibility.ts";
import { HAS_FRONTIER_API_KEYS } from "../src/frontier/gate.ts";
import {
  ACTIVE_TIER_KEY,
  advanceActiveTier,
  type FrontierKv,
  NO_ACTIVE_TIER,
  readActiveTier,
  resetActiveTier,
} from "../src/frontier/pointer.ts";
import {
  __selectFrontierLaneForTest,
  buildFrontierRouter,
  frontierLaneAttributes,
  selectFrontierLane,
} from "../src/frontier/select.ts";
import { type FrontierEnv, frontierTiers } from "../src/frontier/tiers.ts";

// In-memory FrontierKv with call spies.
function fakeKv(initial?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    _store: store,
  } satisfies FrontierKv & { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; _store: Map<string, string> };
}

// A fully-populated env so `frontierTiers` returns all six tiers.
const fullEnv: FrontierEnv = {
  FRONTIER_ANTHROPIC_KEY_1: "k-a1",
  FRONTIER_ANTHROPIC_KEY_2: "k-a2",
  FRONTIER_ANTHROPIC_KEY_3: "k-a3",
  FRONTIER_OPENAI_KEY_1: "k-o1",
  FRONTIER_OPENAI_KEY_2: "k-o2",
  FRONTIER_OPENAI_KEY_3: "k-o3",
  FRONTIER_OPENAI_MODEL_1: "gpt-test-1",
  FRONTIER_OPENAI_MODEL_2: "gpt-test-2",
  FRONTIER_OPENAI_MODEL_3: "gpt-test-3",
};

const prodEndUser: FrontierEligibilityCtx = {
  environment: "production",
  isPreview: false,
  principalKind: "user",
  e2e: false,
};

describe("SK-FRONTIER-001 — shipped dormancy (the load-bearing test)", () => {
  it("HAS_FRONTIER_API_KEYS ships as false", () => {
    expect(HAS_FRONTIER_API_KEYS).toBe(false);
  });

  it("selectFrontierLane returns null and touches NO kv/env/provider", async () => {
    const kv = fakeKv({ [ACTIVE_TIER_KEY]: "anthropic-1" });
    const tiers = frontierTiers(fullEnv);
    const result = await selectFrontierLane({ ctx: prodEndUser, tiers, kv });
    expect(result).toBeNull();
    // The gate short-circuits BEFORE any KV access.
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
  });
});

describe("SK-FRONTIER-004 — isFrontierEligible", () => {
  it("true only for production + non-preview + non-e2e + real-user principal", () => {
    expect(isFrontierEligible(prodEndUser)).toBe(true);
    for (const kind of ["sk_live", "pk_live", "anon"]) {
      expect(isFrontierEligible({ ...prodEndUser, principalKind: kind })).toBe(true);
    }
  });

  it("false for non-production environment", () => {
    expect(isFrontierEligible({ ...prodEndUser, environment: "preview" })).toBe(false);
    expect(isFrontierEligible({ ...prodEndUser, environment: "development" })).toBe(false);
  });

  it("false for preview deploys", () => {
    expect(isFrontierEligible({ ...prodEndUser, isPreview: true })).toBe(false);
  });

  it("false for e2e flows", () => {
    expect(isFrontierEligible({ ...prodEndUser, e2e: true })).toBe(false);
  });

  it("false for each test/synthetic principal kind", () => {
    for (const kind of ["sk_mcp", "e2e", "test"]) {
      expect(isFrontierEligible({ ...prodEndUser, principalKind: kind })).toBe(false);
    }
  });
});

describe("SK-FRONTIER-002 — frontierTiers ladder", () => {
  it("ordered Anthropic [opus,sonnet,haiku] then OpenAI [1,2,3]", () => {
    const tiers = frontierTiers(fullEnv);
    expect(tiers.map((t) => t.id)).toEqual([
      "anthropic-1",
      "anthropic-2",
      "anthropic-3",
      "openai-1",
      "openai-2",
      "openai-3",
    ]);
    expect(tiers.map((t) => t.provider)).toEqual([
      "anthropic",
      "anthropic",
      "anthropic",
      "openai",
      "openai",
      "openai",
    ]);
  });

  it("applies the Anthropic model defaults when env model is unset", () => {
    const tiers = frontierTiers(fullEnv);
    const anthropic = tiers.filter((t) => t.provider === "anthropic");
    expect(anthropic.map((t) => t.model)).toEqual([
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ]);
  });

  it("carries the env model override + keyEnv name + parsed budget", () => {
    const tiers = frontierTiers({
      ...fullEnv,
      FRONTIER_ANTHROPIC_MODEL_1: "claude-custom",
      FRONTIER_TIER_BUDGET_ANTHROPIC_1: "12345",
    });
    const t = tiers[0];
    expect(t?.model).toBe("claude-custom");
    expect(t?.keyEnv).toBe("FRONTIER_ANTHROPIC_KEY_1");
    expect(t?.budgetTokens).toBe(12345);
  });

  it("skips tiers whose key env is unset or blank", () => {
    const tiers = frontierTiers({
      FRONTIER_ANTHROPIC_KEY_1: "k-a1",
      FRONTIER_ANTHROPIC_KEY_3: "   ", // whitespace ⇒ skipped
      FRONTIER_OPENAI_KEY_2: "k-o2",
    });
    expect(tiers.map((t) => t.id)).toEqual(["anthropic-1", "openai-2"]);
  });

  it("returns an empty ladder when no keys are configured", () => {
    expect(frontierTiers({})).toEqual([]);
  });
});

describe("SK-FRONTIER-003 — KV active-tier pointer", () => {
  const tiers = frontierTiers(fullEnv);

  it("read defaults to the top tier when unset", async () => {
    const kv = fakeKv();
    expect(await readActiveTier(kv, tiers)).toBe("anthropic-1");
  });

  it("read returns the stored value when set", async () => {
    const kv = fakeKv({ [ACTIVE_TIER_KEY]: "openai-1" });
    expect(await readActiveTier(kv, tiers)).toBe("openai-1");
  });

  it("read on an empty ladder yields 'none'", async () => {
    const kv = fakeKv();
    expect(await readActiveTier(kv, [])).toBe(NO_ACTIVE_TIER);
  });

  it("advance walks the ladder one step and stops at 'none'", async () => {
    const kv = fakeKv();
    expect(await advanceActiveTier(kv, tiers, "anthropic-1")).toBe("anthropic-2");
    expect(await advanceActiveTier(kv, tiers, "anthropic-2")).toBe("anthropic-3");
    expect(await advanceActiveTier(kv, tiers, "anthropic-3")).toBe("openai-1");
    expect(await advanceActiveTier(kv, tiers, "openai-1")).toBe("openai-2");
    expect(await advanceActiveTier(kv, tiers, "openai-2")).toBe("openai-3");
    expect(await advanceActiveTier(kv, tiers, "openai-3")).toBe(NO_ACTIVE_TIER);
    expect(kv._store.get(ACTIVE_TIER_KEY)).toBe(NO_ACTIVE_TIER);
  });

  it("advance from an unknown tier id yields 'none'", async () => {
    const kv = fakeKv();
    expect(await advanceActiveTier(kv, tiers, "bogus")).toBe(NO_ACTIVE_TIER);
  });

  it("reset returns the pointer to the top tier", async () => {
    const kv = fakeKv({ [ACTIVE_TIER_KEY]: NO_ACTIVE_TIER });
    await resetActiveTier(kv, tiers);
    expect(kv._store.get(ACTIVE_TIER_KEY)).toBe("anthropic-1");
  });
});

// The ladder is non-empty for `fullEnv`; narrow once so tests don't need
// non-null assertions on the array index.
function topTier() {
  const [top] = frontierTiers(fullEnv);
  if (!top) throw new Error("expected a non-empty ladder");
  return top;
}

describe("frontierLaneAttributes", () => {
  it("emits bounded, key-redacted tier attrs", () => {
    const attrs = frontierLaneAttributes(topTier());
    expect(attrs).toEqual({
      "llm.dispatch_lane": "frontier",
      "llm.billed_to": "platform",
      "llm.frontier_tier": "anthropic-1",
      "llm.frontier_provider": "anthropic",
    });
    expect(JSON.stringify(attrs)).not.toContain("k-a1");
  });
});

describe("buildFrontierRouter", () => {
  it("fails loud on a blank key (GLOBAL-012)", () => {
    expect(() => buildFrontierRouter(topTier(), "   ")).toThrow(/apiKey/);
  });

  it("builds a single-provider router for the tier's provider endpoint", async () => {
    const seen: { url: string; auth: string | null; model: string }[] = [];
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input.toString(), init);
      const body = (await req.clone().json()) as { model: string };
      seen.push({ url: req.url, auth: req.headers.get("authorization"), model: body.model });
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"sql":"SELECT 1"}' } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const router = buildFrontierRouter(topTier(), "k-a1");
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(seen[0]?.url).toBe("https://api.anthropic.com/v1/chat/completions");
    expect(seen[0]?.auth).toBe("Bearer k-a1");
    expect(seen[0]?.model).toBe("claude-opus-4-8");
  });
});

// SK-FRONTIER-001 — if the gate WERE true (test-only seam, shipped constant
// stays false), the eligibility + pointer gates resolve correctly.
describe("__selectFrontierLaneForTest (gate stubbed true)", () => {
  const tiers = frontierTiers(fullEnv);

  it("ineligible ctx ⇒ null even with gate true", async () => {
    const kv = fakeKv({ [ACTIVE_TIER_KEY]: "anthropic-1" });
    const result = await __selectFrontierLaneForTest(true, {
      ctx: { ...prodEndUser, e2e: true },
      tiers,
      kv,
    });
    expect(result).toBeNull();
    expect(kv.get).not.toHaveBeenCalled();
  });

  it("'none' pointer ⇒ null", async () => {
    const kv = fakeKv({ [ACTIVE_TIER_KEY]: NO_ACTIVE_TIER });
    const result = await __selectFrontierLaneForTest(true, { ctx: prodEndUser, tiers, kv });
    expect(result).toBeNull();
  });

  it("live pointer ⇒ the matching tier", async () => {
    const kv = fakeKv({ [ACTIVE_TIER_KEY]: "openai-1" });
    const result = await __selectFrontierLaneForTest(true, { ctx: prodEndUser, tiers, kv });
    expect(result?.id).toBe("openai-1");
    expect(result?.provider).toBe("openai");
  });

  it("default (unset) pointer ⇒ the top tier", async () => {
    const kv = fakeKv();
    const result = await __selectFrontierLaneForTest(true, { ctx: prodEndUser, tiers, kv });
    expect(result?.id).toBe("anthropic-1");
  });

  it("gate false still short-circuits before kv", async () => {
    const kv = fakeKv({ [ACTIVE_TIER_KEY]: "anthropic-1" });
    const result = await __selectFrontierLaneForTest(false, { ctx: prodEndUser, tiers, kv });
    expect(result).toBeNull();
    expect(kv.get).not.toHaveBeenCalled();
  });
});
