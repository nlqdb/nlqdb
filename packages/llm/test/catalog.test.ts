// SK-PREMIUM-013 / SK-PREMIUM-015 — invariants for the canonical model catalog
// snapshot. These pin the shape every surface relies on (the picker id format,
// the per-provider rows, the BYOLLM provider/model presence) so a careless
// snapshot edit fails loud here rather than as a broken picker.

import { describe, expect, it } from "vitest";
import { isModelPreset, MODEL_CATALOG, MODEL_PRESETS } from "../src/catalog.ts";

describe("MODEL_CATALOG (SK-PREMIUM-013)", () => {
  it("exposes exactly the auto|fast|best presets, in order", () => {
    expect(MODEL_CATALOG.presets.map((p) => p.id)).toEqual(["auto", "fast", "best"]);
    for (const p of MODEL_CATALOG.presets) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  // SK-PREMIUM-014 — the wire validator and the picker render from the same
  // list; a preset added to one without the other fails here.
  it("MODEL_PRESETS mirrors the catalog presets (validator lockstep)", () => {
    expect(MODEL_CATALOG.presets.map((p) => p.id)).toEqual([...MODEL_PRESETS]);
    for (const id of MODEL_PRESETS) expect(isModelPreset(id)).toBe(true);
    expect(isModelPreset("gpt-5.6")).toBe(false);
    expect(isModelPreset("")).toBe(false);
    expect(isModelPreset(undefined)).toBe(false);
  });

  it("carries a keyless free row with copy", () => {
    expect(MODEL_CATALOG.free.label.length).toBeGreaterThan(0);
    expect(MODEL_CATALOG.free.note.length).toBeGreaterThan(0);
  });

  it("has at least one frontier provider row", () => {
    expect(MODEL_CATALOG.providers.length).toBeGreaterThanOrEqual(1);
  });

  it("gives every provider a brand, key copy, models, and a default in the list", () => {
    for (const p of MODEL_CATALOG.providers) {
      expect(p.provider, `${p.label} provider`).toBeTruthy();
      expect(p.label.length, `${p.provider} label`).toBeGreaterThan(0);
      expect(p.keyLabel.length, `${p.provider} keyLabel`).toBeGreaterThan(0);
      expect(p.keyPlaceholder.length, `${p.provider} keyPlaceholder`).toBeGreaterThan(0);
      expect(p.models.length, `${p.provider} models`).toBeGreaterThanOrEqual(1);
      // The default must be one of the offered models.
      expect(
        p.models.some((m) => m.model === p.defaultModel),
        `${p.provider} default`,
      ).toBe(true);
      for (const m of p.models) {
        expect(m.model, `${m.id} model`).toBeTruthy();
        expect(m.label.length, `${m.id} label`).toBeGreaterThan(0);
        // The picker splits the id back into provider+model for the
        // account-store / header lane, so it must be exactly that join.
        expect(m.id).toBe(`${p.provider}:${m.model}`);
      }
    }
  });

  it("has unique picker ids across all providers", () => {
    const ids = MODEL_CATALOG.providers.flatMap((p) => p.models.map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
