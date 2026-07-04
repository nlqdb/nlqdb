import { describe, expect, it } from "vitest";
import { openAICompatibleChat } from "../../src/providers/openai-compatible.ts";
import { ProviderError } from "../../src/types.ts";
import { jsonResponse, openAIChatResponse } from "../_fixtures.ts";

const chatArgs = {
  url: "https://openrouter.ai/api/v1/chat/completions",
  apiKey: "k",
  model: "m",
  messages: [],
};

async function reasonOf(body: unknown): Promise<string> {
  const fetch = () => Promise.resolve(jsonResponse(body));
  try {
    await openAICompatibleChat(chatArgs, { fetch });
  } catch (err) {
    return err instanceof ProviderError ? err.reason : `not-a-ProviderError:${String(err)}`;
  }
  throw new Error("expected openAICompatibleChat to throw");
}

describe("openAICompatibleChat header merge", () => {
  it("forwards caller headers (e.g. AI Gateway control headers)", async () => {
    let seen: Headers | undefined;
    const fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      seen = new Request(input.toString(), init).headers;
      return Promise.resolve(openAIChatResponse("ok"));
    };
    await openAICompatibleChat(
      {
        url: "https://x/y",
        apiKey: "k",
        model: "m",
        messages: [],
        headers: { "cf-aig-cache-key": "ns" },
      },
      { fetch },
    );
    expect(seen?.get("cf-aig-cache-key")).toBe("ns");
  });

  it("the fixed apiKey always wins — caller headers can't clobber Authorization", async () => {
    // Security-load-bearing: `authorization` is applied after the
    // caller's `headers`, so a malicious/buggy header map can never
    // swap the upstream credential.
    let auth: string | null = null;
    const fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      auth = new Request(input.toString(), init).headers.get("authorization");
      return Promise.resolve(openAIChatResponse("ok"));
    };
    await openAICompatibleChat(
      {
        url: "https://x/y",
        apiKey: "real-key",
        model: "m",
        messages: [],
        headers: { authorization: "Bearer evil" },
      },
      { fetch },
    );
    expect(auth).toBe("Bearer real-key");
  });
});

describe("openAICompatibleChat 200-body error envelope (SK-LLM-042)", () => {
  it("a 429-shaped error body → rate_limited (capacity, not a scored no_sql)", async () => {
    expect(await reasonOf({ error: { message: "Provider returned error", code: 429 } })).toBe(
      "rate_limited",
    );
  });

  it("a 'rate limit' message with no numeric code → rate_limited", async () => {
    expect(await reasonOf({ error: { message: "upstream rate limit exceeded" } })).toBe(
      "rate_limited",
    );
  });

  it("OpenRouter metadata.error_type mentioning rate → rate_limited", async () => {
    expect(
      await reasonOf({ error: { message: "boom", metadata: { error_type: "rate_limited" } } }),
    ).toBe("rate_limited");
  });

  it("a generic upstream error body → provider_error (retryable, not parse)", async () => {
    expect(await reasonOf({ error: { message: "upstream model crashed", code: 502 } })).toBe(
      "provider_error",
    );
  });

  it("a 'rate' substring inside a word (e.g. 'generate') is NOT a rate limit", async () => {
    // Guards against a bare `.includes("rate")` — "generate" / "accurate"
    // must classify as provider_error, not a spurious rate_limited pause.
    expect(await reasonOf({ error: { message: "model failed to generate output" } })).toBe(
      "provider_error",
    );
  });

  it("an error body with no message still classifies (no throw on JSON.stringify path)", async () => {
    expect(await reasonOf({ error: { code: 500 } })).toBe("provider_error");
  });

  it("a well-formed 200 with content is untouched — no regression", async () => {
    const fetch = () => Promise.resolve(openAIChatResponse("SELECT 1"));
    await expect(openAICompatibleChat(chatArgs, { fetch })).resolves.toBe("SELECT 1");
  });

  it("a 200 missing content and with no error field stays parse (genuinely malformed)", async () => {
    expect(await reasonOf({ id: "x", choices: [] })).toBe("parse");
  });

  it("a valid 200 carrying an explicit `error: null` is untouched — content wins", async () => {
    // Gateways that always include the field send `null` on success; the
    // truthiness guard must let a good answer through, not throw.
    const fetch = () =>
      Promise.resolve(
        jsonResponse({ error: null, choices: [{ message: { content: "SELECT 1" } }] }),
      );
    await expect(openAICompatibleChat(chatArgs, { fetch })).resolves.toBe("SELECT 1");
  });
});
