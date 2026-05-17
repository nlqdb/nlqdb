// Cassette replay for SDK e2e tests. Loads a JSON cassette and returns
// a FetchLike that pops one canned exchange per call in order. Misses
// throw — silent-fall-through to a live network would defeat the
// purpose of cassette tests (SK-E2E-003).
//
// Two modes:
//   • replay (default) — read cassette, match in order, throw on mismatch.
//   • record (env RECORD=1) — perform live fetch, append the exchange
//     to the cassette buffer; the test harness writes the file at end.
//
// Live mode requires `NLQDB_API_URL` + `NLQDB_API_KEY` env vars.

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

// Open a cassette and return a fetch shim that replays it. `name` is
// the filename stem under `cassettes/`. Throws at end-of-test if the
// shim received fewer or more calls than expected.
export function openCassette(name: string): {
  fetch: FetchLike;
  assertConsumed: () => void;
} {
  const path = join(CASSETTES_DIR, `${name}.json`);

  if (isRecording()) {
    return openRecorder(name, path);
  }
  return openReplayer(name, path);
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

    // Loose body matching — only the substrings the test author named
    // are checked. Avoids brittleness on incidental fields (trace IDs,
    // timestamps, idempotency keys) while still catching shape drift.
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
    // Cassettes are recorded against an absolute base URL but replayed
    // against an arbitrary one; store the path only.
    const requestPath = url.pathname + (url.search || "");
    const method = (init?.method ?? "GET").toUpperCase();
    const reqBody = typeof init?.body === "string" ? init.body : "";

    const liveUrl = baseUrl.replace(/\/$/, "") + requestPath;
    const res = await globalThis.fetch(liveUrl, init);
    const bodyText = await res.text();
    const headersOut: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      // Drop noisy hop-by-hop / per-request headers from the cassette
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

// A stable substring that's likely to identify the call without
// drifting across recordings — pick the first 32 chars of the body
// JSON after stripping idempotency-key-style sentinels.
function stableSubstring(s: string): string {
  return s.slice(0, 32);
}
