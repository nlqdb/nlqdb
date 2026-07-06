import { describe, expect, it } from "vitest";
import {
  type ByollmCredential,
  buildByollmRouter,
  dispatchLaneAttributes,
  selectDispatchLane,
} from "../src/byollm-dispatch.ts";
import { AllProvidersFailedError } from "../src/router.ts";
import { mockFetch, openAIChatResponse } from "./_fixtures.ts";

const header: ByollmCredential = {
  apiKey: "sk-header",
  upstream: "anthropic",
  model: "claude-4-5-sonnet",
};
const account: ByollmCredential = { apiKey: "sk-account", upstream: "openai", model: "gpt-5.2" };

describe("selectDispatchLane (SK-LLM-016 precedence)", () => {
  it("header key wins over everything", () => {
    const sel = selectDispatchLane({
      headerCredential: header,
      accountCredential: account,
      premiumEligible: true,
    });
    expect(sel).toEqual({ lane: "byollm", credential: header, source: "header" });
  });

  it("account key wins when no header key", () => {
    const sel = selectDispatchLane({ accountCredential: account, premiumEligible: true });
    expect(sel).toEqual({ lane: "byollm", credential: account, source: "account" });
  });

  it("premium when eligible and no BYOLLM key", () => {
    expect(selectDispatchLane({ premiumEligible: true })).toEqual({ lane: "premium" });
  });

  it("free is the floor", () => {
    expect(selectDispatchLane({})).toEqual({ lane: "free" });
    expect(selectDispatchLane({ headerCredential: null, accountCredential: null })).toEqual({
      lane: "free",
    });
  });
});

describe("selectDispatchLane — model preset (SK-PREMIUM-014)", () => {
  it('"fast" pins the free lane even over credentials and premium eligibility', () => {
    const sel = selectDispatchLane({
      headerCredential: header,
      accountCredential: account,
      premiumEligible: true,
      preset: "fast",
    });
    expect(sel).toEqual({ lane: "free" });
  });

  it('"best" rides a BYOLLM credential when one exists', () => {
    expect(selectDispatchLane({ accountCredential: account, preset: "best" })).toEqual({
      lane: "byollm",
      credential: account,
      source: "account",
    });
  });

  it('"best" resolves premium when eligible and keyless', () => {
    expect(selectDispatchLane({ premiumEligible: true, preset: "best" })).toEqual({
      lane: "premium",
    });
  });

  it('"best" with no frontier lane is unavailable — never a silent free downgrade', () => {
    expect(selectDispatchLane({ preset: "best" })).toEqual({
      lane: "unavailable",
      requested: "best",
    });
  });

  it('"auto" matches the plain precedence', () => {
    expect(selectDispatchLane({ preset: "auto" })).toEqual({ lane: "free" });
    expect(selectDispatchLane({ headerCredential: header, preset: "auto" })).toEqual({
      lane: "byollm",
      credential: header,
      source: "header",
    });
  });
});

describe("dispatchLaneAttributes", () => {
  it("byollm: lane + billed_to=byollm + upstream slug + source, never the key", () => {
    const attrs = dispatchLaneAttributes({ lane: "byollm", credential: header, source: "header" });
    expect(attrs).toEqual({
      "llm.dispatch_lane": "byollm",
      "llm.billed_to": "byollm",
      "llm.byollm_provider": "anthropic",
      "llm.byollm_source": "header",
    });
    expect(JSON.stringify(attrs)).not.toContain("sk-header");
  });

  it("byollm: source reflects the account lane when the credential is account-stored", () => {
    const attrs = dispatchLaneAttributes({
      lane: "byollm",
      credential: account,
      source: "account",
    });
    expect(attrs["llm.byollm_source"]).toBe("account");
  });

  it("premium → metered, free → platform (GLOBAL-026 taxonomy)", () => {
    expect(dispatchLaneAttributes({ lane: "premium" })).toEqual({
      "llm.dispatch_lane": "premium",
      "llm.billed_to": "metered",
    });
    expect(dispatchLaneAttributes({ lane: "free" })).toEqual({
      "llm.dispatch_lane": "free",
      "llm.billed_to": "platform",
    });
  });

  it("unavailable → lane only (never stamped on a served ask; nothing is billed)", () => {
    expect(dispatchLaneAttributes({ lane: "unavailable", requested: "best" })).toEqual({
      "llm.dispatch_lane": "unavailable",
    });
  });
});

describe("buildByollmRouter", () => {
  const gw = { accountId: "acc", gatewayId: "gw", userId: "user-A" };

  it("routes every op through the user's key at the AI Gateway unified endpoint", async () => {
    const seen: { url: string; auth: string | null; model: string }[] = [];
    const fetch = mockFetch([
      {
        match: /gateway\.ai\.cloudflare\.com/,
        respond: async (req) => {
          const body = (await req.clone().json()) as { model: string };
          seen.push({ url: req.url, auth: req.headers.get("authorization"), model: body.model });
          return openAIChatResponse(JSON.stringify({ sql: "SELECT 1" }));
        },
      },
    ]);
    const router = buildByollmRouter({ credential: account, ...gw });
    await router.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(seen[0]?.url).toBe(
      "https://gateway.ai.cloudflare.com/v1/acc/gw/compat/chat/completions",
    );
    expect(seen[0]?.auth).toBe("Bearer sk-account");
    expect(seen[0]?.model).toBe("openai/gpt-5.2");
  });

  it("fails loud (no free-chain fallback) when the user's key errors — SK-LLM-016", async () => {
    const fetch = mockFetch([
      {
        match: /gateway\.ai\.cloudflare\.com/,
        respond: () => new Response("nope", { status: 500 }),
      },
    ]);
    const router = buildByollmRouter({ credential: account, ...gw });
    await expect(
      router.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch }),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it("fails loud at construction on a blank/whitespace key (GLOBAL-012)", () => {
    expect(() => buildByollmRouter({ credential: { ...account, apiKey: "   " }, ...gw })).toThrow(
      /apiKey/,
    );
  });
});
