// Shared chat-completions caller for OpenAI-compatible HTTP APIs
// (Groq, OpenRouter, and the Workers AI REST shape — close enough).
// Lean by design: no SDK deps, just fetch.
//
// Per @nlqdb GUIDELINES §1: we'd rather write 60 lines than pull in
// the OpenAI / Vercel-AI / LangChain SDK trees for what is ultimately
// `POST /v1/chat/completions` with a JSON body.

import { type CallOpts, ProviderError } from "../types.ts";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatRequest = {
  url: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  // OpenAI-compat providers honour `response_format: {type:"json_object"}`
  // for structured outputs; we only set it when the caller wants JSON.
  jsonResponse?: boolean;
  // Forwarded into the request body verbatim. Most callers leave this
  // undefined — the provider's defaults are fine.
  temperature?: number;
};

export async function openAICompatibleChat(req: ChatRequest, opts?: CallOpts): Promise<string> {
  const fetchFn = opts?.fetch ?? globalThis.fetch;
  const body = {
    model: req.model,
    messages: req.messages,
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.jsonResponse ? { response_format: { type: "json_object" } } : {}),
  };

  let res: Response;
  try {
    res = await fetchFn(req.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${req.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") throw new ProviderError("aborted", "timeout");
    throw new ProviderError(`fetch failed: ${e.message}`, "network");
  }

  if (!res.ok) {
    const reason = res.status >= 500 ? "http_5xx" : "http_4xx";
    throw new ProviderError(`http ${res.status}`, reason, res.status);
  }

  let parsed: { choices?: Array<{ message?: { content?: string } }> };
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    throw new ProviderError("response not JSON", "parse");
  }
  const content = parsed.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new ProviderError("response missing choices[0].message.content", "parse");
  }
  return content;
}

// Strict JSON parser used by classify/plan responses. Tolerates the
// common-but-annoying ```json fences some models emit despite
// response_format being set.
export function parseJsonResponse<T>(raw: string): T {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new ProviderError(`response not parseable JSON: ${raw.slice(0, 80)}`, "parse");
  }
}
