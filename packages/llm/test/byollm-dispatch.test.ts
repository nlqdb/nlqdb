import { describe, expect, it } from "vitest";
import {
  type ByollmCredential,
  byollmChains,
  resolveByollmDispatch,
} from "../src/byollm-dispatch.ts";
import { mockFetch, openAIChatResponse } from "./_fixtures.ts";

const cred: ByollmCredential = { apiKey: "sk-user", upstream: "openai", model: "gpt-5.2" };
const gateway = { accountId: "acc", gatewayId: "gw" };
const base = { premiumAvailable: false, gateway, userId: "user-A" } as const;

describe("resolveByollmDispatch — precedence (SK-LLM-016)", () => {
  it("override wins outright (highest precedence)", () => {
    const res = resolveByollmDispatch({
      ...base,
      override: { ...cred, model: "from-override" },
      stored: { ...cred, model: "from-stored" },
    });
    expect(res.lane).toBe("byollm");
    if (res.lane === "byollm") {
      expect(res.source).toBe("override");
      expect(res.provider.model("plan")).toBe("openai/from-override");
    }
  });

  it("falls to the account-stored key when no override is present", () => {
    const res = resolveByollmDispatch({ ...base, stored: cred });
    expect(res.lane).toBe("byollm");
    if (res.lane === "byollm") expect(res.source).toBe("stored");
  });

  it("selects premium when no key is present but premium is available", () => {
    expect(resolveByollmDispatch({ ...base, premiumAvailable: true }).lane).toBe("premium");
  });

  it("selects free when no key and no premium", () => {
    expect(resolveByollmDispatch(base).lane).toBe("free");
  });

  it("a present key beats premium availability (key > premium)", () => {
    const res = resolveByollmDispatch({ ...base, premiumAvailable: true, stored: cred });
    expect(res.lane).toBe("byollm");
  });
});

describe("resolveByollmDispatch — fail-loud, no silent fallback (GLOBAL-012)", () => {
  it("throws on a structurally-invalid present key instead of demoting", () => {
    // Empty model on a present override: must fail loud, NOT fall to
    // the stored key or to free. Silent demotion is the rejected dark
    // pattern.
    expect(() =>
      resolveByollmDispatch({
        ...base,
        premiumAvailable: true,
        override: { ...cred, model: "" },
        stored: cred,
      }),
    ).toThrow(/model/);
  });

  it("rejects a userId that isn't header-safe (propagated from the factory)", () => {
    expect(() => resolveByollmDispatch({ ...base, userId: "bad\nid", stored: cred })).toThrow(
      /userId/,
    );
  });
});

describe("resolveByollmDispatch — provider wiring", () => {
  it("builds a provider that targets the gateway with the user's key", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const fetch = mockFetch([
      {
        match: /gateway\.ai\.cloudflare\.com/,
        respond: (req) => {
          seen.push({ url: req.url, auth: req.headers.get("authorization") });
          return openAIChatResponse(JSON.stringify({ sql: "SELECT 1" }));
        },
      },
    ]);
    const res = resolveByollmDispatch({ ...base, stored: cred });
    if (res.lane !== "byollm") throw new Error("expected byollm lane");
    await res.provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(seen[0]?.url).toBe(
      "https://gateway.ai.cloudflare.com/v1/acc/gw/compat/chat/completions",
    );
    expect(seen[0]?.auth).toBe("Bearer sk-user");
  });

  it("forwards the gateway token only when set", () => {
    const withTok = resolveByollmDispatch({
      ...base,
      override: { ...cred, gatewayToken: "cf-tok" },
    });
    // Smoke: construction succeeds with the optional token present.
    expect(withTok.lane).toBe("byollm");
  });
});

describe("byollmChains — no-fallback single-entry chains", () => {
  it("pins every operation to the lone byollm provider with no fallback", () => {
    const chains = byollmChains();
    for (const op of ["route", "plan", "summarize", "schema_infer", "engine_classify"] as const) {
      expect(chains[op]).toEqual(["byollm"]);
    }
  });
});
