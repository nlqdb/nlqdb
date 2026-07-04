// SK-PREMIUM-013 — invariants for the canonical model catalog. These pin
// the shape every surface relies on (the picker id format, the BYOLLM
// provider/model presence) so a careless catalog edit fails loud here
// rather than as a broken picker.

import { describe, expect, it } from "vitest";
import { MODEL_CATALOG } from "../src/catalog.ts";

describe("MODEL_CATALOG (SK-PREMIUM-013)", () => {
  it("exposes exactly the auto|fast|best presets, in order", () => {
    expect(MODEL_CATALOG.presets.map((p) => p.id)).toEqual(["auto", "fast", "best"]);
    for (const p of MODEL_CATALOG.presets) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("leads with the keyless free entry", () => {
    const first = MODEL_CATALOG.models[0];
    expect(first?.id).toBe("free");
    expect(first?.lane).toBe("free");
    expect(first?.needsKey).toBe(false);
  });

  it("has at least one named frontier option", () => {
    const frontier = MODEL_CATALOG.models.filter((m) => m.lane === "byollm");
    expect(frontier.length).toBeGreaterThanOrEqual(1);
  });

  it("gives every BYOLLM entry a provider+model, needsKey, and a matching id", () => {
    for (const m of MODEL_CATALOG.models) {
      if (m.lane !== "byollm") continue;
      expect(m.provider, `${m.id} provider`).toBeTruthy();
      expect(m.model, `${m.id} model`).toBeTruthy();
      expect(m.needsKey, `${m.id} needsKey`).toBe(true);
      // The picker splits the id back into provider+model for the
      // account-store / header lane, so it must be exactly that join.
      expect(m.id).toBe(`${m.provider}:${m.model}`);
    }
  });

  it("has unique picker ids", () => {
    const ids = MODEL_CATALOG.models.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
