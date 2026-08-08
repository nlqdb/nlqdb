import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// SK-WEB-029 — the analytics-consent gate. The load-bearing behaviours: nothing
// reads as granted until the user opts in (fail-closed), and whenConsentGranted
// fires the PostHog loader exactly once — immediately if already granted, or the
// moment Accept dispatches the grant — never before opt-in and never twice.

import { isConsentGranted, readConsent, setConsent, whenConsentGranted } from "./consent";

// `window` is undefined in bun test; consent.ts guards on it, so we install a
// minimal stub backing localStorage with a Map and events with an EventTarget.
function installWindow() {
  const store = new Map<string, string>();
  const target = new EventTarget();
  // biome-ignore lint/suspicious/noExplicitAny: test-only global stub
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k) : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  return { store };
}

beforeEach(() => {
  installWindow();
});

afterEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test-only global cleanup
  delete (globalThis as any).window;
});

describe("readConsent / setConsent", () => {
  test("defaults to unset (fail-closed — nothing loads without an opt-in)", () => {
    expect(readConsent()).toBe("unset");
    expect(isConsentGranted()).toBe(false);
  });

  test("grant and deny round-trip", () => {
    setConsent(true);
    expect(readConsent()).toBe("granted");
    expect(isConsentGranted()).toBe(true);

    setConsent(false);
    expect(readConsent()).toBe("denied");
    expect(isConsentGranted()).toBe(false);
  });

  test("an unrecognised stored value reads as unset, not granted", () => {
    // e.g. a value written under a future version prefix after a re-ask bump.
    window.localStorage.setItem("nlqdb_consent", "9:granted");
    expect(readConsent()).toBe("unset");
    expect(isConsentGranted()).toBe(false);
  });
});

describe("whenConsentGranted", () => {
  test("runs immediately when consent is already granted", () => {
    setConsent(true);
    let ran = 0;
    whenConsentGranted(() => ran++);
    expect(ran).toBe(1);
  });

  test("does not run while unset, then runs once when granted later", () => {
    let ran = 0;
    whenConsentGranted(() => ran++);
    expect(ran).toBe(0); // never fires a cookie before opt-in

    setConsent(true);
    expect(ran).toBe(1);
  });

  test("never runs on a denial", () => {
    let ran = 0;
    whenConsentGranted(() => ran++);
    setConsent(false);
    expect(ran).toBe(0);
  });

  test("runs only once even if consent is granted repeatedly", () => {
    let ran = 0;
    whenConsentGranted(() => ran++);
    setConsent(true);
    setConsent(true);
    expect(ran).toBe(1);
  });

  test("fires on a later grant even after an initial denial", () => {
    let ran = 0;
    whenConsentGranted(() => ran++);
    setConsent(false);
    setConsent(true);
    expect(ran).toBe(1);
  });
});
