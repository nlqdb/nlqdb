// Unit coverage for the apps/api BYOLLM header half (SK-LLM-016 step 1):
// the `x-nlq-byollm-key` wire format and the free-vs-BYOLLM router
// resolution. Pure functions — no worker harness needed.

import type { LLMRouter } from "@nlqdb/llm";
import { describe, expect, it } from "vitest";
import { parseByollmHeader, resolveAskRouter } from "../src/ask/byollm.ts";

// Sentinel for the free-chain router: resolveAskRouter returns it
// by identity on the non-BYOLLM path, so a marker object proves the
// passthrough without standing up the real router.
const FREE = { __free: true } as unknown as LLMRouter;

describe("parseByollmHeader", () => {
  it("treats an absent or blank header as no BYOLLM intent", () => {
    expect(parseByollmHeader(undefined)).toEqual({ ok: true, credential: null });
    expect(parseByollmHeader("")).toEqual({ ok: true, credential: null });
    expect(parseByollmHeader("   ")).toEqual({ ok: true, credential: null });
  });

  it("parses <provider>:<model>:<key> into a credential", () => {
    expect(parseByollmHeader("openai:gpt-5.2:sk-abc123")).toEqual({
      ok: true,
      credential: { upstream: "openai", model: "gpt-5.2", apiKey: "sk-abc123" },
    });
  });

  it("lower-cases and trims the provider slug", () => {
    expect(parseByollmHeader("  Anthropic : claude-4-5-sonnet : sk-ant-xyz ")).toEqual({
      ok: true,
      credential: { upstream: "anthropic", model: "claude-4-5-sonnet", apiKey: "sk-ant-xyz" },
    });
  });

  it("keeps a key that itself contains a colon (splits on the first two only)", () => {
    const res = parseByollmHeader("google-ai-studio:gemini-2.5-flash:abc:def:ghi");
    expect(res).toEqual({
      ok: true,
      credential: {
        upstream: "google-ai-studio",
        model: "gemini-2.5-flash",
        apiKey: "abc:def:ghi",
      },
    });
  });

  it("fails loud on a malformed (too-few-parts) value", () => {
    expect(parseByollmHeader("openai:gpt-5.2")).toMatchObject({ ok: false });
    expect(parseByollmHeader("just-a-key")).toMatchObject({ ok: false });
  });

  it("fails loud on a blank model or key", () => {
    expect(parseByollmHeader("openai::sk-abc")).toMatchObject({ ok: false });
    expect(parseByollmHeader("openai:gpt-5.2:")).toMatchObject({ ok: false });
  });

  it("accepts Grok (compat) and OpenRouter (dedicated path) — SK-PREMIUM-008 superseded", () => {
    expect(parseByollmHeader("grok:grok-4.5:xai-abc")).toEqual({
      ok: true,
      credential: { upstream: "grok", model: "grok-4.5", apiKey: "xai-abc" },
    });
    // OpenRouter model ids carry a `/` (no colon) so they survive the split.
    expect(parseByollmHeader("openrouter:openai/gpt-5.6:sk-or-abc")).toEqual({
      ok: true,
      credential: { upstream: "openrouter", model: "openai/gpt-5.6", apiKey: "sk-or-abc" },
    });
  });

  it("rejects a provider not on the allowlist", () => {
    const res = parseByollmHeader("cohere:command-r:key-abc");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("openai, anthropic, google-ai-studio");
  });
});

describe("resolveAskRouter", () => {
  const gateway = { accountId: "acc123", gatewayId: "gw456" };

  it("falls through to the free router (free lane attributes) with no credential", () => {
    const res = resolveAskRouter({
      headerCredential: null,
      freeRouter: FREE,
      gateway,
      userId: "u1",
    });
    expect(res).toEqual({
      ok: true,
      router: FREE,
      attributes: { "llm.dispatch_lane": "free", "llm.billed_to": "platform" },
    });
  });

  it("builds a BYOLLM router + redacted lane attributes when a header credential is present", () => {
    const res = resolveAskRouter({
      headerCredential: { upstream: "openai", model: "gpt-5.2", apiKey: "sk-secret" },
      freeRouter: FREE,
      gateway,
      userId: "user_abc",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.router).not.toBe(FREE);
      expect(res.attributes).toEqual({
        "llm.dispatch_lane": "byollm",
        "llm.billed_to": "byollm",
        "llm.byollm_provider": "openai",
        "llm.byollm_source": "header",
      });
      // The key never appears in the span attributes.
      expect(JSON.stringify(res.attributes)).not.toContain("sk-secret");
    }
  });

  it("uses the account-stored credential (source=account) when no header key is present", () => {
    const res = resolveAskRouter({
      headerCredential: null,
      accountCredential: { upstream: "anthropic", model: "claude-4-5-sonnet", apiKey: "sk-acct" },
      freeRouter: FREE,
      gateway,
      userId: "user_abc",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.router).not.toBe(FREE);
      expect(res.attributes).toEqual({
        "llm.dispatch_lane": "byollm",
        "llm.billed_to": "byollm",
        "llm.byollm_provider": "anthropic",
        "llm.byollm_source": "account",
      });
      expect(JSON.stringify(res.attributes)).not.toContain("sk-acct");
    }
  });

  it("header credential wins over an account-stored credential (SK-LLM-016 precedence)", () => {
    const res = resolveAskRouter({
      headerCredential: { upstream: "openai", model: "gpt-5.2", apiKey: "sk-header" },
      accountCredential: { upstream: "anthropic", model: "claude-4-5-sonnet", apiKey: "sk-acct" },
      freeRouter: FREE,
      gateway,
      userId: "user_abc",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.attributes["llm.byollm_source"]).toBe("header");
  });

  it("falls through to the free router when neither header nor account credential is present", () => {
    const res = resolveAskRouter({
      headerCredential: null,
      accountCredential: null,
      freeRouter: FREE,
      gateway,
      userId: "u1",
    });
    expect(res).toEqual({
      ok: true,
      router: FREE,
      attributes: { "llm.dispatch_lane": "free", "llm.billed_to": "platform" },
    });
  });

  it("reports gateway_unconfigured when a BYOLLM key arrives but AI Gateway is unset", () => {
    const res = resolveAskRouter({
      headerCredential: { upstream: "openai", model: "gpt-5.2", apiKey: "sk-secret" },
      freeRouter: FREE,
      gateway: {},
      userId: "u1",
    });
    expect(res).toEqual({ ok: false, reason: "gateway_unconfigured" });
  });

  // SK-PREMIUM-014 — the `model` preset knob.
  it('preset "fast" pins the free router even when a credential is stored', () => {
    const res = resolveAskRouter({
      headerCredential: null,
      accountCredential: { upstream: "anthropic", model: "claude-4-5-sonnet", apiKey: "sk-acct" },
      preset: "fast",
      freeRouter: FREE,
      gateway,
      userId: "u1",
    });
    expect(res).toEqual({
      ok: true,
      router: FREE,
      attributes: {
        "llm.dispatch_lane": "free",
        "llm.billed_to": "platform",
        "llm.model_preset": "fast",
      },
    });
  });

  it('preset "best" rides the stored BYOLLM credential when one exists', () => {
    const res = resolveAskRouter({
      headerCredential: null,
      accountCredential: { upstream: "anthropic", model: "claude-4-5-sonnet", apiKey: "sk-acct" },
      preset: "best",
      freeRouter: FREE,
      gateway,
      userId: "u1",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.router).not.toBe(FREE);
      expect(res.attributes["llm.dispatch_lane"]).toBe("byollm");
      expect(res.attributes["llm.model_preset"]).toBe("best");
    }
  });

  it('preset "best" with no frontier lane reports frontier_unavailable — never a silent free downgrade', () => {
    const res = resolveAskRouter({
      headerCredential: null,
      accountCredential: null,
      preset: "best",
      freeRouter: FREE,
      gateway,
      userId: "u1",
    });
    expect(res).toEqual({ ok: false, reason: "frontier_unavailable" });
  });

  it('preset "auto" keeps the plain precedence (free with no credential)', () => {
    const res = resolveAskRouter({
      headerCredential: null,
      preset: "auto",
      freeRouter: FREE,
      gateway,
      userId: "u1",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.router).toBe(FREE);
      expect(res.attributes["llm.model_preset"]).toBe("auto");
    }
  });
});
