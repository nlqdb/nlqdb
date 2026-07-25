import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// SK-ANON-015 — the cross-origin handoff is the only thing standing
// between "never lose a prompt" (SK-ANON-011) and the marketing→app
// origin split (SK-AUTH-016). These tests pin the round-trip: what one
// origin serializes into the fragment, the other imports verbatim —
// and the fragment is stripped so the payload never lingers in the
// address bar. The import is also a security boundary: the fragment is
// attacker-writable, so payloads are shape-validated and only honored
// behind a trusted referrer.

import {
  ANON_PREV_KEY,
  attachHandoff,
  buildHandoffPayload,
  importHandoffFromLocation,
  parseHandoff,
  serializeHandoff,
} from "./handoff";
import { saveDraft } from "./prompt-storage";

// Valid per the client mint format: `anon_` + ≥16 chars of [A-Za-z0-9-].
const ANON_A = "anon_aaaaaaaaaaaaaaaa";
const ANON_NEW = "anon_nnnnnnnnnnnnnnnn";
const ANON_OLD = "anon_oooooooooooooooo";

let store: Map<string, string>;
let replacedUrl: string | null;

function installWindow(href: string, referrer = "https://nlqdb.com/", failWrites = false) {
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failWrites) throw new DOMException("quota", "QuotaExceededError");
      store.set(k, v);
    },
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  const url = new URL(href);
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    location: { href: url.toString(), hash: url.hash },
    history: {
      replaceState: (_s: unknown, _t: string, next: string) => {
        replacedUrl = next;
      },
    },
  };
  (globalThis as unknown as { document: unknown }).document = { referrer };
}

beforeEach(() => {
  store = new Map();
  replacedUrl = null;
  installWindow("https://nlqdb.com/app/new/");
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { document?: unknown }).document;
});

describe("serialize / parse", () => {
  test("round-trips a full payload", () => {
    const payload = {
      v: 1 as const,
      anon: ANON_A,
      pending: { goal: "add a pool", submittedAt: "2026-07-02T00:00:00Z" },
      draft: "add a pool",
    };
    expect(parseHandoff(serializeHandoff(payload))).toEqual(payload);
  });

  test("rejects non-handoff hashes and garbage", () => {
    expect(parseHandoff("")).toBeNull();
    expect(parseHandoff("#other=1")).toBeNull();
    expect(parseHandoff("#nlq=not-json")).toBeNull();
    expect(parseHandoff(`#nlq=${encodeURIComponent('{"v":2}')}`)).toBeNull();
    expect(parseHandoff(`#nlq=${encodeURIComponent('"just-a-string"')}`)).toBeNull();
  });

  test("drops malformed fields but keeps valid ones", () => {
    const mixed = `#nlq=${encodeURIComponent(
      JSON.stringify({
        v: 1,
        anon: "anon_$injection$aaaa",
        pending: { goal: "add a pool", submittedAt: 42, origin: "https://evil.example/x" },
        draft: { nested: "object" },
      }),
    )}`;
    // `origin` was a dead field on `PendingPrompt`; an attacker-supplied one is
    // not copied through at all now (no key on the output object).
    expect(parseHandoff(mixed)).toEqual({
      v: 1,
      pending: { goal: "add a pool", submittedAt: "" },
    });
  });

  // The fragment is attacker-writable, so the parser is a trust boundary even
  // before the referrer gate: it must not be walkable into the prototype chain
  // and must not throw on anything a crafted link can put in the URL.
  test("survives prototype-pollution and malformed input without throwing", () => {
    const frag = (s: string) => `#nlq=${encodeURIComponent(s)}`;
    expect(
      parseHandoff(frag('{"v":1,"draft":"ok","__proto__":{"polluted":true},"constructor":{}}')),
    ).toEqual({ v: 1, draft: "ok" });
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    // `goal` reachable only through a JSON `__proto__` key is not a real
    // property, so the pending is dropped rather than half-built.
    expect(parseHandoff(frag('{"v":1,"pending":{"__proto__":{"goal":"x"}}}'))).toBeNull();
    // Truncated percent-encoding (URIError) and a 1 MB fragment.
    expect(parseHandoff("#nlq=%E0%A4%A")).toBeNull();
    expect(parseHandoff(`#nlq=${"a".repeat(1_000_000)}`)).toBeNull();
    // An XSS payload is inert data — carried as text, never a URL or HTML.
    expect(parseHandoff(frag('{"v":1,"draft":"<img src=x onerror=alert(1)>"}'))?.draft).toBe(
      "<img src=x onerror=alert(1)>",
    );
  });

  test("rejects payloads with nothing valid left", () => {
    const bad = `#nlq=${encodeURIComponent(
      JSON.stringify({ v: 1, anon: "anon_x", pending: { goal: { evil: true } }, draft: "" }),
    )}`;
    expect(parseHandoff(bad)).toBeNull();
  });
});

// SK-ANON-011 forbids silent prompt loss, and the cap is the one place a
// prompt could vanish without anybody noticing — the receiver used to reject
// >MAX_TEXT text outright, so a long goal landed the visitor on an empty input.
describe("the MAX_TEXT cap is symmetric and never drops a prompt", () => {
  const OVERSIZE = "x".repeat(5000);
  const frag = (p: unknown) => `#nlq=${encodeURIComponent(JSON.stringify(p))}`;

  test("an oversize draft is truncated, not dropped — receiver", () => {
    const out = parseHandoff(frag({ v: 1, draft: OVERSIZE }));
    expect(out?.draft).toBe("x".repeat(4096));
  });

  test("an oversize draft is truncated, not dropped — sender", () => {
    store.set("nlqdb_draft", OVERSIZE);
    expect(buildHandoffPayload()?.draft).toBe("x".repeat(4096));
  });

  test("an oversize pending demotes to draft and is never queued for replay", () => {
    const out = parseHandoff(frag({ v: 1, pending: { goal: OVERSIZE, submittedAt: "t" } }));
    expect(out?.pending).toBeUndefined();
    expect(out?.draft).toBe("x".repeat(4096));
  });

  test("the sender demotes an oversize pending the same way", () => {
    store.set("nlqdb_pending", JSON.stringify({ goal: OVERSIZE, submittedAt: "t" }));
    const payload = buildHandoffPayload();
    expect(payload?.pending).toBeUndefined();
    expect(payload?.draft).toBe("x".repeat(4096));
  });

  test("a demoted pending reaches the app origin's draft slot, and nothing replays", () => {
    store.set("nlqdb_pending", JSON.stringify({ goal: OVERSIZE, submittedAt: "t" }));
    const target = attachHandoff("/app/new/");
    store = new Map();
    installWindow(`https://app.nlqdb.com/app/new/${target.slice(target.indexOf("#"))}`);
    importHandoffFromLocation();
    expect(store.get("nlqdb_draft")).toBe("x".repeat(4096));
    expect(store.get("nlqdb_pending")).toBeUndefined();
  });

  test("under-cap text is untouched on both sides", () => {
    const under = "y".repeat(4096);
    expect(parseHandoff(frag({ v: 1, draft: under }))?.draft).toBe(under);
    store.set("nlqdb_draft", under);
    expect(buildHandoffPayload()?.draft).toBe(under);
  });
});

describe("buildHandoffPayload / attachHandoff", () => {
  test("returns null / no-op when there is nothing to carry", () => {
    expect(buildHandoffPayload()).toBeNull();
    expect(attachHandoff("https://app.nlqdb.com/auth/sign-in")).toBe(
      "https://app.nlqdb.com/auth/sign-in",
    );
  });

  test("snapshots anon + pending + draft from localStorage", () => {
    store.set("nlqdb_anon", ANON_A);
    store.set("nlqdb_pending", JSON.stringify({ goal: "add a pool", submittedAt: "t" }));
    store.set("nlqdb_draft", "add a pool");
    const payload = buildHandoffPayload();
    expect(payload?.anon).toBe(ANON_A);
    expect(payload?.pending?.goal).toBe("add a pool");
    expect(payload?.draft).toBe("add a pool");
  });

  test("skips malformed tokens and corrupt pending slots", () => {
    store.set("nlqdb_anon", "not-a-token");
    store.set("nlqdb_pending", "{corrupt");
    expect(buildHandoffPayload()).toBeNull();
  });

  test("attachHandoff replaces any existing fragment", () => {
    store.set("nlqdb_draft", "orders tracker");
    const out = attachHandoff("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp#old");
    expect(out.startsWith("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp#nlq=")).toBe(true);
    expect(out).not.toContain("#old");
  });
});

describe("importHandoffFromLocation", () => {
  function arriveWith(
    payload: Parameters<typeof serializeHandoff>[0],
    referrer = "https://nlqdb.com/",
  ) {
    installWindow(
      `https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp${serializeHandoff(payload)}`,
      referrer,
    );
  }

  test("persists pending + draft + anon and strips the fragment", () => {
    arriveWith({
      v: 1,
      anon: ANON_A,
      pending: { goal: "add a pool", submittedAt: "t" },
      draft: "add a pool",
    });
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe(ANON_A);
    expect(JSON.parse(store.get("nlqdb_pending") ?? "{}").goal).toBe("add a pool");
    expect(store.get("nlqdb_draft")).toBe("add a pool");
    expect(replacedUrl).toBe("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp");
  });

  test("parks a differing local anon token under the prev key", () => {
    arriveWith({ v: 1, anon: ANON_NEW });
    store.set("nlqdb_anon", ANON_OLD);
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe(ANON_NEW);
    expect(store.get(ANON_PREV_KEY)).toBe(ANON_OLD);
  });

  test("same token does not park a prev entry", () => {
    arriveWith({ v: 1, anon: ANON_A });
    store.set("nlqdb_anon", ANON_A);
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe(ANON_A);
    expect(store.has(ANON_PREV_KEY)).toBe(false);
  });

  test("accepts a same-origin referrer", () => {
    arriveWith({ v: 1, anon: ANON_A }, "https://app.nlqdb.com/app/new/");
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe(ANON_A);
  });

  test("rejects a foreign referrer but still strips the fragment", () => {
    arriveWith({ v: 1, anon: ANON_NEW, draft: "planted" }, "https://evil.example/");
    store.set("nlqdb_anon", ANON_OLD);
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe(ANON_OLD);
    expect(store.has("nlqdb_draft")).toBe(false);
    expect(store.has(ANON_PREV_KEY)).toBe(false);
    expect(replacedUrl).toBe("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp");
  });

  test("rejects a lookalike-domain referrer", () => {
    arriveWith({ v: 1, anon: ANON_NEW }, "https://evil-nlqdb.com/");
    importHandoffFromLocation();
    expect(store.has("nlqdb_anon")).toBe(false);
  });

  test("rejects a missing referrer (no provenance) but strips the fragment", () => {
    arriveWith({ v: 1, anon: ANON_A }, "");
    importHandoffFromLocation();
    expect(store.has("nlqdb_anon")).toBe(false);
    expect(replacedUrl).toBe("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp");
  });

  // A full quota (or Safari private mode) throws from `setItem`, not from the
  // `localStorage` getter `safeStorage()` guards. The throw must not escape:
  // this runs at the top of `app/new.astro`'s script, ahead of
  // `getOrMintAnonToken()`, and it must not leave the bearer in the URL.
  test("a throwing setItem neither escapes nor leaves the fragment behind", () => {
    installWindow(
      `https://app.nlqdb.com/app/new/${serializeHandoff({ v: 1, anon: ANON_A, draft: "d" })}`,
      "https://nlqdb.com/",
      true,
    );
    expect(() => importHandoffFromLocation()).not.toThrow();
    expect(replacedUrl).toBe("https://app.nlqdb.com/app/new/");
  });

  test("no fragment → no writes, no history rewrite", () => {
    importHandoffFromLocation();
    expect(store.size).toBe(0);
    expect(replacedUrl).toBeNull();
  });
});

// The referrer gate is the whole anti-fixation boundary: a crafted `#nlq=`
// link plants an attacker-known bearer, which at sign-in adopts the attacker's
// DB into the victim's account. The trusted set is therefore an explicit
// allowlist, not a `*.nlqdb.com` suffix match — one dangling subdomain would
// otherwise inherit credential-granting trust.
describe("the trusted-referrer allowlist", () => {
  function accepts(referrer: string, here = "https://app.nlqdb.com/app/new/"): boolean {
    store = new Map();
    installWindow(`${here}${serializeHandoff({ v: 1, anon: ANON_A })}`, referrer);
    importHandoffFromLocation();
    return store.get("nlqdb_anon") === ANON_A;
  }

  test("accepts every host that legitimately hands off", () => {
    expect(accepts("https://nlqdb.com/solve/x/")).toBe(true);
    expect(accepts("https://www.nlqdb.com/vs/y/")).toBe(true);
    expect(accepts("https://app.nlqdb.com/auth/sign-in/")).toBe(true);
  });

  test("rejects a non-listed nlqdb.com subdomain — no wildcard trust", () => {
    expect(accepts("https://evil.nlqdb.com/")).toBe(false);
    // Real subdomains we serve, but which hold no prompt state and never call
    // `attachHandoff` — trust fails closed for them too.
    expect(accepts("https://docs.nlqdb.com/")).toBe(false);
    expect(accepts("https://mcp.nlqdb.com/")).toBe(false);
  });

  test("rejects suffix-confusion hosts", () => {
    expect(accepts("https://nlqdb.com.evil.com/")).toBe(false);
    expect(accepts("https://evil-nlqdb.com/")).toBe(false);
    expect(accepts("https://notnlqdb.com/")).toBe(false);
    expect(accepts("https://xnlqdb.com/")).toBe(false);
  });

  test("rejects a plaintext referrer for a production hop", () => {
    expect(accepts("http://nlqdb.com/")).toBe(false);
  });

  // The dev affordance, gated on the receiving page also being local, so a
  // process on the developer's machine can never hand a bearer to production.
  test("localhost is trusted only while the receiving page is itself local", () => {
    expect(accepts("http://localhost:4321/", "http://localhost:8787/app/new/")).toBe(true);
    expect(accepts("http://127.0.0.1:4321/", "http://localhost:8787/app/new/")).toBe(true);
    expect(accepts("http://localhost:4321/")).toBe(false);
    expect(accepts("http://127.0.0.1:4321/")).toBe(false);
  });
});

describe("content-CTA handoff (the /solve · /vs · /agents 'Try this query' arc)", () => {
  const GOAL = "today's orders aggregated by drink with revenue";

  test("a goal saved on the marketing origin arrives in the app origin's draft slot", () => {
    // The regression this pins: the CTAs called `saveDraft` and then navigated
    // to `/app/new/`, which 301s to `app.nlqdb.com` — a different origin, so
    // the draft was written to storage the create form could never read and
    // every visitor landed on an empty input. Walk both origins for real.
    installWindow("https://nlqdb.com/solve/cheap-internal-dashboard/");
    saveDraft(GOAL);
    const target = attachHandoff("/app/new/");
    expect(target).toStartWith("/app/new/#nlq=");

    // Second origin: fresh storage, as a real cross-origin hop gets.
    store = new Map();
    installWindow(`https://app.nlqdb.com/app/new/${target.slice(target.indexOf("#"))}`);
    expect(store.get("nlqdb_draft")).toBeUndefined();

    importHandoffFromLocation();
    expect(store.get("nlqdb_draft")).toBe(GOAL);
    expect(replacedUrl).toBe("https://app.nlqdb.com/app/new/");
  });

  test("carries nothing when the visitor never typed a goal", () => {
    installWindow("https://nlqdb.com/solve/cheap-internal-dashboard/");
    expect(attachHandoff("/app/new/")).toBe("/app/new/");
  });
});
