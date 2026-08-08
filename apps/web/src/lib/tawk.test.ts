import { afterEach, describe, expect, test } from "bun:test";

// The bug this module fixes: without an identity call, Tawk shows only its own
// anonymous visitor id. These tests assert the *behaviour* — that setAttributes
// is invoked with the account's name/email/user-id — not just that a config
// object is shaped right. The two timing races are the load-bearing part, so
// both are exercised explicitly.

import type { SessionUser } from "./session";
import { identifyTawkVisitor, tawkAttributes } from "./tawk";

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
});

const user: SessionUser = { id: "u_123", name: "Ada Lovelace", email: "ada@example.com" };

describe("tawkAttributes", () => {
  test("carries name, email, and the nlqdb user id", () => {
    expect(tawkAttributes(user)).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      "user-id": "u_123",
    });
  });

  test("name falls back to email, then id, so there is always a display name", () => {
    expect(tawkAttributes({ id: "u_1", email: "a@b.c" }).name).toBe("a@b.c");
    expect(tawkAttributes({ id: "u_1" }).name).toBe("u_1");
  });

  test("omits email entirely when the account has none (empty string is invalid)", () => {
    expect(tawkAttributes({ id: "u_1" })).not.toHaveProperty("email");
  });
});

describe("identifyTawkVisitor", () => {
  test("no-op for an anonymous (null) session — never touches Tawk", () => {
    const w = installWindow(true);
    identifyTawkVisitor(null);
    expect(w.calls).toHaveLength(0);
  });

  test("widget already loaded: sets attributes immediately", () => {
    const w = installWindow(/* withSetAttributes */ true);
    identifyTawkVisitor(user);
    expect(w.calls).toHaveLength(1);
    expect(w.calls[0]?.attributes).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      "user-id": "u_123",
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
