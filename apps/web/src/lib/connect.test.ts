import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// `postConnect` (SK-WEB-019) MUST:
//   - POST the exact `{ engine, connection_url, name? }` body the
//     `/v1/db/connect` orchestrator expects (SK-DBCONN-001),
//   - run with `credentials: "include"` (the page is auth-guarded, so the
//     cookie session is the principal — opposite of the anon hero create),
//   - NEVER touch localStorage (the connection URL is a secret — GLOBAL-031),
//   - surface the API's one-sentence error `message` verbatim (GLOBAL-012),
//   - return the schemaPreview on success.

import { postConnect } from "./connect";

type Captured = {
  url: string;
  method?: string;
  credentials?: RequestCredentials;
  headers: Headers;
  body: unknown;
};

const originalFetch = globalThis.fetch;
let captured: Captured | null = null;
let storageWrites = 0;

function mockFetch(response: Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = {
      url: String(input),
      method: init?.method,
      credentials: init?.credentials,
      headers: new Headers(init?.headers ?? {}),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    return response;
  }) as typeof fetch;
}

beforeEach(() => {
  captured = null;
  storageWrites = 0;
  // Spy on any localStorage write so the "never persisted" guarantee is
  // enforced by the test, not just by inspection.
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storageWrites++;
      store.set(k, v);
    },
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  (globalThis as unknown as { window: unknown; localStorage: unknown }).window = {
    localStorage: storage,
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = storage;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

const SECRET_URL = "https://user:secretpass@host:8443/?database=analytics";

describe("postConnect", () => {
  test("posts the right body, with credentials:'include', to /v1/db/connect", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          dbId: "db_analytics_abc123",
          name: "analytics",
          engine: "clickhouse",
          schemaPreview: "CREATE TABLE events (...)",
          pkLive: "pk_live_xyz",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    const outcome = await postConnect("https://api.example", {
      engine: "clickhouse",
      connectionUrl: SECRET_URL,
      name: "analytics",
    });

    expect(captured?.url).toBe("https://api.example/v1/db/connect");
    expect(captured?.method).toBe("POST");
    expect(captured?.credentials).toBe("include");
    expect(captured?.body).toEqual({
      engine: "clickhouse",
      connection_url: SECRET_URL,
      name: "analytics",
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.schemaPreview).toContain("CREATE TABLE events");
      expect(outcome.result.dbId).toBe("db_analytics_abc123");
    }
  });

  test("never writes the connection URL (or anything) to localStorage", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          dbId: "db_x_1",
          name: "x",
          engine: "clickhouse",
          schemaPreview: "",
          pkLive: null,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    await postConnect("", { engine: "clickhouse", connectionUrl: SECRET_URL });

    expect(storageWrites).toBe(0);
  });

  test("omits an empty/whitespace name from the body", async () => {
    mockFetch(new Response(JSON.stringify({}), { status: 201 }));
    await postConnect("", { engine: "postgres", connectionUrl: SECRET_URL, name: "   " });
    expect(captured?.body).toEqual({
      engine: "postgres",
      connection_url: SECRET_URL,
    });
  });

  test("surfaces the API error message verbatim (GLOBAL-012)", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          error: { status: 403, message: "Connecting your own database requires an account." },
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    );

    const outcome = await postConnect("", { engine: "clickhouse", connectionUrl: SECRET_URL });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(403);
      expect(outcome.message).toBe("Connecting your own database requires an account.");
    }
  });

  test("falls back to a generic sentence when the error body isn't the expected shape", async () => {
    mockFetch(new Response("upstream boom", { status: 502 }));
    const outcome = await postConnect("", { engine: "clickhouse", connectionUrl: SECRET_URL });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(502);
      expect(outcome.message.length).toBeGreaterThan(0);
    }
  });

  test("returns a network-failure sentence when fetch throws", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;

    const outcome = await postConnect("", { engine: "clickhouse", connectionUrl: SECRET_URL });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(0);
      expect(outcome.message).toContain("Couldn't reach the API");
    }
  });
});
