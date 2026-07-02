import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// SK-ANON-012 / SK-ANON-015 — client adoption fallback. Pins that BOTH
// the active anon token and a handoff-displaced one get adopted, that
// the prev slot clears only on a successful adopt, and that the caller
// gets the active token's dbId for the SK-ANON-014 pin.

import { adoptAnonNow } from "./anon-adopt";

const originalFetch = globalThis.fetch;
let store: Map<string, string>;
let posted: string[];
let respond: (anon: string) => Response;

beforeEach(() => {
  store = new Map();
  posted = [];
  respond = (anon) =>
    new Response(JSON.stringify({ adopted: true, dbId: `db_for_${anon}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const anon = new Headers(init?.headers ?? {}).get("x-anon-bearer") ?? "";
    posted.push(anon);
    return respond(anon);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("adoptAnonNow", () => {
  test("adopts the active token and returns its dbId", async () => {
    store.set("nlqdb_anon", "anon_a");
    expect(await adoptAnonNow("")).toBe("db_for_anon_a");
    expect(posted).toEqual(["anon_a"]);
  });

  test("adopts a handoff-displaced prev token too, then clears the slot", async () => {
    store.set("nlqdb_anon", "anon_new");
    store.set("nlqdb_anon_prev", "anon_old");
    expect(await adoptAnonNow("")).toBe("db_for_anon_new");
    expect(posted).toEqual(["anon_old", "anon_new"]);
    expect(store.has("nlqdb_anon_prev")).toBe(false);
  });

  test("keeps the prev slot when its adoption fails, so the next sign-in retries", async () => {
    store.set("nlqdb_anon", "anon_new");
    store.set("nlqdb_anon_prev", "anon_old");
    respond = (anon) =>
      anon === "anon_old"
        ? new Response("nope", { status: 500 })
        : new Response(JSON.stringify({ adopted: true, dbId: "db_new" }), { status: 200 });
    expect(await adoptAnonNow("")).toBe("db_new");
    expect(store.get("nlqdb_anon_prev")).toBe("anon_old");
  });

  test("no tokens → no requests", async () => {
    expect(await adoptAnonNow("")).toBeNull();
    expect(posted).toEqual([]);
  });
});
