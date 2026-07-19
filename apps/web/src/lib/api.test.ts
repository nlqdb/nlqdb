import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// `postAskCreate` MUST run with `credentials: "omit"` so the hero's
// `/v1/ask` POST never rides the session cookie when the user is
// already signed in. Without this, `requirePrincipal` (SK-ANON-008)
// resolves the request as the authed user, the SK-ANON-012 device
// cap is never consulted, and the anon → sign-in handoff breaks.

type CapturedInit = { credentials?: RequestCredentials; headers?: Headers };

const originalFetch = globalThis.fetch;
let captured: CapturedInit | null = null;

function mockFetch(response: Response) {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    captured = {
      credentials: init?.credentials,
      headers: new Headers(init?.headers ?? {}),
    };
    return response;
  }) as typeof fetch;
}

beforeEach(() => {
  captured = null;
  // `getOrMintAnonToken` reads `window.localStorage` — under bun:test
  // there's no DOM, so synthesize the minimum surface it expects.
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    crypto: globalThis.crypto,
  };
  storage.setItem("nlqdb_anon", "anon_test_token_1234567890");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("postAskCreate", () => {
  test("sends credentials: 'omit' so the session cookie never rides the hero create", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          kind: "create",
          db: "db_x",
          displayName: "x",
          schemaName: "x",
          pkLive: null,
          plan: {},
          sampleRows: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    // Import lazily so the `window` stub is in place when `anon.ts`
    // (imported transitively by `api.ts`) first runs the SSR guard.
    const { postAskCreate } = await import("./api.ts");
    await postAskCreate("", "test goal");

    expect(captured?.credentials).toBe("omit");
    // The anon bearer still rides — only the cookie is dropped.
    expect(captured?.headers?.get("authorization")).toMatch(/^Bearer anon_/);
  });

  // The API reports an unusable goal as `422 infer_failed` (index.ts
  // formatCreateJsonResponse). A vague hero goal ("test", "stuff")
  // trips `ambiguous_goal`; a plan that fails validation trips
  // `plan_invalid`. Both must surface `goal_unclear` — the actionable
  // "describe what you want to build" copy — NOT the misleading
  // "try again" of `server_error` (retrying the same goal fails again).
  for (const reason of ["ambiguous_goal", "plan_invalid"] as const) {
    test(`maps 422 infer_failed/${reason} to goal_unclear`, async () => {
      mockFetch(
        new Response(JSON.stringify({ error: { kind: "infer_failed", reason } }), {
          status: 422,
          headers: { "content-type": "application/json" },
        }),
      );
      const { postAskCreate } = await import("./api.ts");
      const out = await postAskCreate("", "test");
      expect(out).toEqual({ ok: false, error: { kind: "goal_unclear" } });
    });
  }

  test("leaves other 422 kinds (transient/internal) as server_error", async () => {
    mockFetch(
      new Response(JSON.stringify({ error: { kind: "compile_failed" } }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }),
    );
    const { postAskCreate } = await import("./api.ts");
    const out = await postAskCreate("", "a real goal");
    expect(out).toEqual({ ok: false, error: { kind: "server_error", status: 422 } });
  });
});
