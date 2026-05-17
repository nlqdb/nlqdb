import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Exchange = {
  request: { method: string; path: string; bodyContains?: string[] };
  response: { status: number; headers?: Record<string, string>; body: unknown };
};

type Cassette = { exchanges: Exchange[] };

const CASSETTES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "cassettes");

export function isRecording(): boolean {
  return (process.env["RECORD"] ?? "").trim() === "1";
}

export function liveBaseUrl(): string | null {
  const url = (process.env["NLQDB_API_URL"] ?? "").trim();
  return url === "" ? null : url;
}

export function liveApiKey(): string | null {
  const key = (process.env["NLQDB_API_KEY"] ?? "").trim();
  return key === "" ? null : key;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function openCassette(name: string): {
  fetch: FetchLike;
  assertConsumed: () => void;
} {
  const path = join(CASSETTES_DIR, `${name}.json`);
  return isRecording() ? openRecorder(name, path) : openReplayer(name, path);
}

function openReplayer(
  name: string,
  path: string,
): {
  fetch: FetchLike;
  assertConsumed: () => void;
} {
  const cassette: Cassette = JSON.parse(readFileSync(path, "utf-8"));
  let idx = 0;

  const fetch: FetchLike = async (input, init) => {
    const exchange = cassette.exchanges[idx];
    if (!exchange) {
      throw new Error(
        `cassette ${name}: extra call #${idx + 1} not in cassette — re-record with RECORD=1 or trim the test`,
      );
    }
    const method = (init?.method ?? "GET").toUpperCase();
    const url = new URL(typeof input === "string" ? input : input.toString());
    const path = url.pathname + (url.search || "");

    if (method !== exchange.request.method) {
      throw new Error(
        `cassette ${name}@${idx}: method ${method} ≠ expected ${exchange.request.method}`,
      );
    }
    if (path !== exchange.request.path) {
      throw new Error(`cassette ${name}@${idx}: path ${path} ≠ expected ${exchange.request.path}`);
    }

    // Substring matching keeps the cassette stable across regenerated idempotency keys and timestamps.
    if (exchange.request.bodyContains && exchange.request.bodyContains.length > 0) {
      const body = typeof init?.body === "string" ? init.body : "";
      for (const needle of exchange.request.bodyContains) {
        if (!body.includes(needle)) {
          throw new Error(
            `cassette ${name}@${idx}: request body missing expected substring ${JSON.stringify(needle)}`,
          );
        }
      }
    }

    idx++;
    return new Response(JSON.stringify(exchange.response.body), {
      status: exchange.response.status,
      headers: {
        "content-type": "application/json",
        ...(exchange.response.headers ?? {}),
      },
    });
  };

  return {
    fetch,
    assertConsumed: () => {
      if (idx !== cassette.exchanges.length) {
        throw new Error(
          `cassette ${name}: ${idx} of ${cassette.exchanges.length} exchanges consumed — test must replay every exchange or trim the cassette`,
        );
      }
    },
  };
}

function openRecorder(
  name: string,
  path: string,
): {
  fetch: FetchLike;
  assertConsumed: () => void;
} {
  const baseUrl = liveBaseUrl();
  const apiKey = liveApiKey();
  if (!baseUrl || !apiKey) {
    throw new Error(
      `cassette ${name}: RECORD=1 requires NLQDB_API_URL and NLQDB_API_KEY env vars (target staging URL + key)`,
    );
  }

  const recorded: Exchange[] = [];
  const fetch: FetchLike = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const requestPath = url.pathname + (url.search || "");
    const method = (init?.method ?? "GET").toUpperCase();
    const reqBody = typeof init?.body === "string" ? init.body : "";

    const liveUrl = baseUrl.replace(/\/$/, "") + requestPath;
    const res = await globalThis.fetch(liveUrl, init);
    const bodyText = await res.text();
    const headersOut: Record<string, string> = {};
    // Strip per-request headers so replayed cassettes don't lie about identity.
    res.headers.forEach((v, k) => {
      if (!["date", "x-request-id", "cf-ray", "set-cookie"].includes(k.toLowerCase())) {
        headersOut[k] = v;
      }
    });
    const parsedBody: unknown = bodyText.trim() === "" ? null : JSON.parse(bodyText);
    recorded.push({
      request: {
        method,
        path: requestPath,
        bodyContains: reqBody.length > 0 ? [stableSubstring(reqBody)] : undefined,
      },
      response: { status: res.status, body: parsedBody, headers: headersOut },
    });

    return new Response(bodyText, { status: res.status, headers: res.headers });
  };

  return {
    fetch,
    assertConsumed: () => {
      writeFileSync(path, `${JSON.stringify({ exchanges: recorded }, null, 2)}\n`);
    },
  };
}

function stableSubstring(s: string): string {
  return s.slice(0, 32);
}
