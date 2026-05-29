import { describe, expect, it } from "vitest";
import { openAICompatibleChat } from "../../src/providers/openai-compatible.ts";
import { openAIChatResponse } from "../_fixtures.ts";

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
