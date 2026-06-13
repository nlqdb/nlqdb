import { NlqdbApiError } from "@nlqdb/sdk";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useNlq } from "../src/runtime/composables.ts";

// `useNlq()` must route through `@nlqdb/sdk` (GLOBAL-001) — never a
// hand-rolled `fetch` — so it inherits the SDK's retry (SK-SDK-008), auto
// Idempotency-Key (SK-SDK-006), and normalized `NlqdbApiError` (SK-SDK-002).
// These tests mirror packages/sdk/test by asserting those wire behaviours
// through the composable.

type FetchCall = { url: string; init: RequestInit };

const g = globalThis as Record<string, unknown>;

const ok = () =>
  new Response(
    JSON.stringify({
      status: "ok",
      rows: [],
      rowCount: 0,
      trace: { sql: "", plan_id: "p", confidence: 1, model: "m", cache_hit: false },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

const errorResponse = (status: number, code: string) => () =>
  new Response(JSON.stringify({ error: { status: code } }), {
    status,
    headers: { "content-type": "application/json" },
  });

let calls: FetchCall[];
let responders: Array<() => Response>;
let responderIdx: number;
const originalFetch = globalThis.fetch;

function installRuntimeConfig(nlqdb: Record<string, unknown> | undefined): void {
  g["useRuntimeConfig"] = () => ({ public: { nlqdb } });
}

function installAsyncData(): void {
  // Mirrors Nuxt's `{ data, error }` ref shape; runs the handler eagerly so
  // the test drives the real SDK call and captures thrown errors into
  // `error.value` exactly as Nuxt does.
  g["useAsyncData"] = async <T>(_key: string, handler: () => Promise<T>) => {
    try {
      return { data: { value: await handler() }, error: { value: null } };
    } catch (error) {
      return { data: { value: null }, error: { value: error } };
    }
  };
}

beforeAll(() => {
  // One stable `fetch` for the whole file: the SDK client is cached per
  // baseUrl+key and captures `globalThis.fetch` at construction, so we swap
  // the per-test `responders` rather than the global.
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
    const make = responders[Math.min(responderIdx, responders.length - 1)] ?? ok;
    responderIdx++;
    return make();
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  calls = [];
  responders = [ok];
  responderIdx = 0;
  installAsyncData();
  installRuntimeConfig({ publishableKey: "pk_live_test", apiBaseUrl: "https://api.test" });
});

afterEach(() => {
  delete g["useAsyncData"];
  delete g["useRuntimeConfig"];
});

describe("useNlq()", () => {
  it("POSTs /v1/ask through the SDK with a bearer + auto Idempotency-Key", async () => {
    const { data, error } = await useNlq("top users");
    expect(error.value).toBeNull();
    expect((data.value as { status: string }).status).toBe("ok");
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0] as FetchCall;
    expect(url).toBe("https://api.test/v1/ask");
    expect((init.method ?? "GET").toUpperCase()).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer pk_live_test");
    // SDK auto-adds this on every mutation; a hand-rolled fetch wouldn't.
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f]{32}$/);
  });

  it("retries a transient 5xx (SK-SDK-008) and reuses one Idempotency-Key", async () => {
    responders = [errorResponse(503, "llm_failed"), ok];
    const { data, error } = await useNlq("top users");
    expect(error.value).toBeNull();
    expect((data.value as { status: string }).status).toBe("ok");
    expect(calls).toHaveLength(2);
    const headersOf = (i: number) => (calls[i] as FetchCall).init.headers as Record<string, string>;
    const k0 = headersOf(0)["idempotency-key"];
    const k1 = headersOf(1)["idempotency-key"];
    expect(k0).toMatch(/^[0-9a-f]{32}$/);
    expect(k1).toBe(k0);
  });

  it("surfaces an API error as a normalized NlqdbApiError in error.value", async () => {
    responders = [errorResponse(404, "db_not_found")];
    const { data, error } = await useNlq("top users", { dbId: "db_x" });
    expect(data.value).toBeNull();
    expect(error.value).toBeInstanceOf(NlqdbApiError);
    expect((error.value as NlqdbApiError).code).toBe("db_not_found");
  });

  it("throws a friendly error when no publishable key is configured", async () => {
    installRuntimeConfig({});
    await expect(useNlq("x")).rejects.toThrow(/publishable key/);
  });

  it("throws when called outside a Nuxt context", async () => {
    delete g["useAsyncData"];
    await expect(useNlq("x")).rejects.toThrow(/inside a Nuxt page or component/);
  });
});
