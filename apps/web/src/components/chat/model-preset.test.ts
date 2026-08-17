import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { MODEL_PRESET_EVENT, readModelPreset, writeModelPreset } from "./model-preset";

// The web-session model preset (SK-PREMIUM-014) — the paid user's only route to
// "Free". Stubs the two globals the module touches (bare `localStorage` like
// ChatPanel, plus `window.dispatchEvent`) and restores them so the shared bun
// process isn't left with a fake DOM.

type G = { localStorage?: unknown; window?: unknown; CustomEvent?: unknown };
const g = globalThis as unknown as G;
let saved: G;
let store: Map<string, string>;
let events: string[];

beforeEach(() => {
  saved = { localStorage: g.localStorage, window: g.window, CustomEvent: g.CustomEvent };
  store = new Map();
  events = [];
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  g.CustomEvent = class {
    type: string;
    detail: unknown;
    constructor(type: string, opts?: { detail?: unknown }) {
      this.type = type;
      this.detail = opts?.detail;
    }
  };
  g.window = { dispatchEvent: (e: { type: string }) => void events.push(e.type) };
});

afterEach(() => {
  g.localStorage = saved.localStorage;
  g.window = saved.window;
  g.CustomEvent = saved.CustomEvent;
});

describe("model-preset", () => {
  it("defaults to auto with nothing stored", () => {
    expect(readModelPreset()).toBe("auto");
  });

  it("persists fast and broadcasts the change", () => {
    writeModelPreset("fast");
    expect(readModelPreset()).toBe("fast");
    expect(events).toContain(MODEL_PRESET_EVENT);
  });

  it("auto clears the stored key (so a later upgrade isn't stuck on free)", () => {
    writeModelPreset("fast");
    writeModelPreset("auto");
    expect(readModelPreset()).toBe("auto");
    expect(store.size).toBe(0);
  });

  it("treats any non-fast stored value as auto", () => {
    store.set("nlqdb:model-preset", "garbage");
    expect(readModelPreset()).toBe("auto");
  });
});
