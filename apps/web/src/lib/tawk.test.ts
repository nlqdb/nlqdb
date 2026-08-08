import { afterEach, describe, expect, test } from "bun:test";

// The bug this module fixes: without an identity call, Tawk shows only its own
// anonymous visitor id — and Tawk Secure Mode only accepts name/email when a
// server-vouched HMAC `hash` accompanies them. These tests assert the
// *behaviour* — that setAttributes is invoked with name/email/user-id/hash, and
// that the identity fetch degrades to null the same way the session probe does —
// not just that an object is shaped right. The two setAttributes timing races
// are the load-bearing part, so both are exercised explicitly.

import { fetchTawkIdentity, identifyTawkVisitor, type TawkIdentity, tawkAttributes } from "./tawk";

type Captured = { attributes: Record<string, string> }[];

// Minimal window/Tawk stub. `window` is undefined in bun test by default, which
// is exactly the `typeof window === "undefined"` branch identifyTawkVisitor
// guards, so we install a stub for the cases that should reach Tawk.
function installWindow(withSetAttributes: boolean): {
  calls: Captured;
  fireOnLoad: () => void;
  addSetAttributes: () => void;
} {
  const calls: Captured = [];
  const setAttributes = (attributes: Record<string, string>, cb: (e?: unknown) => void) => {
    calls.push({ attributes });
    cb();
  };
  // biome-ignore lint/suspicious/noExplicitAny: test-only global stub
  const api: any = {};
  if (withSetAttributes) api.setAttributes = setAttributes;
  // biome-ignore lint/suspicious/noExplicitAny: test-only global stub
  (globalThis as any).window = { Tawk_API: api };
  return {
    calls,
    fireOnLoad: () => api.onLoad?.(),
    addSetAttributes: () => {
      api.setAttributes = setAttributes;
    },
  };
}

afterEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test-only global cleanup
  delete (globalThis as any).window;
  // biome-ignore lint/suspicious/noExplicitAny: restore fetch between tests
  (globalThis as any).fetch = originalFetch;
});

const originalFetch = globalThis.fetch;
const user: TawkIdentity = {
  id: "u_123",
  name: "Ada Lovelace",
  email: "ada@example.com",
  hash: "deadbeef",
};

describe("tawkAttributes", () => {
  test("carries name, email, user id, and the Secure Mode hash", () => {
    expect(tawkAttributes(user)).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      "user-id": "u_123",
      hash: "deadbeef",
    });
  });

  test("name falls back to email, then id, so there is always a display name", () => {
    expect(tawkAttributes({ id: "u_1", email: "a@b.c" }).name).toBe("a@b.c");
    expect(tawkAttributes({ id: "u_1" }).name).toBe("u_1");
  });

  test("omits email and hash when absent (Tawk keeps the anon id, no error)", () => {
    const attrs = tawkAttributes({ id: "u_1" });
    expect(attrs).not.toHaveProperty("email");
    expect(attrs).not.toHaveProperty("hash");
  });
});

describe("identifyTawkVisitor", () => {
  test("no-op for an anonymous (null) session — never touches Tawk", () => {
    const w = installWindow(true);
    identifyTawkVisitor(null);
    expect(w.calls).toHaveLength(0);
  });

  test("widget already loaded: sets attributes immediately, including the hash", () => {
    const w = installWindow(/* withSetAttributes */ true);
    identifyTawkVisitor(user);
    expect(w.calls).toHaveLength(1);
    expect(w.calls[0]?.attributes).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      "user-id": "u_123",
      hash: "deadbeef",
    });
  });

  test("session resolves before the widget loads: applies on the later onLoad", () => {
    // setAttributes does not exist yet — the immediate apply must be a safe
    // no-op, and identity must land once Tawk fires onLoad.
    const w = installWindow(/* withSetAttributes */ false);
    identifyTawkVisitor(user);
    expect(w.calls).toHaveLength(0); // nothing lost, nothing thrown

    w.addSetAttributes(); // widget finishes loading...
    w.fireOnLoad(); // ...and Tawk invokes our onLoad hook
    expect(w.calls).toHaveLength(1);
    expect(w.calls[0]?.attributes["user-id"]).toBe("u_123");
  });

  test("re-applies on every onLoad (covers a widget reload mid-session)", () => {
    const w = installWindow(true);
    identifyTawkVisitor(user); // immediate apply -> 1
    w.fireOnLoad(); // reload -> 2
    w.fireOnLoad(); // reload -> 3
    expect(w.calls).toHaveLength(3);
  });
});

describe("fetchTawkIdentity", () => {
  function stubFetch(impl: () => Promise<Response>) {
    // biome-ignore lint/suspicious/noExplicitAny: test-only fetch stub
    (globalThis as any).fetch = impl as unknown as typeof fetch;
  }

  test("returns the parsed identity (with hash) for a signed-in user", async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify(user), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    expect(await fetchTawkIdentity("")).toEqual(user);
  });

  test("returns null on a non-ok response", async () => {
    stubFetch(async () => new Response("nope", { status: 401 }));
    expect(await fetchTawkIdentity("")).toBeNull();
  });

  test('returns null when the body is the literal "null" (signed out)', async () => {
    stubFetch(async () => new Response("null", { status: 200 }));
    expect(await fetchTawkIdentity("")).toBeNull();
  });

  test("returns null on a network error (bails like the session probe)", async () => {
    stubFetch(async () => {
      throw new Error("offline");
    });
    expect(await fetchTawkIdentity("")).toBeNull();
  });
});
