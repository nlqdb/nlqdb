import { describe, expect, test } from "bun:test";
import { resolveProviderRow } from "./model-picker-selection";

const claude = {
  defaultModel: "claude-opus-4",
  label: "Claude",
  models: [
    { label: "Claude Opus 4", model: "claude-opus-4" },
    { label: "Claude Sonnet 4", model: "claude-sonnet-4" },
    { label: "Claude Haiku 4", model: "claude-haiku-4" },
  ],
};

describe("resolveProviderRow", () => {
  test("no active, no pending → flagship default, not active", () => {
    const r = resolveProviderRow(claude, null, null);
    expect(r.shownModel).toBe("claude-opus-4");
    expect(r.shownLabel).toBe("Claude Opus 4");
    expect(r.isActive).toBe(false);
  });

  test("active model → shows it and marks the row active", () => {
    const r = resolveProviderRow(claude, "claude-opus-4", null);
    expect(r.shownLabel).toBe("Claude Opus 4");
    expect(r.isActive).toBe(true);
  });

  // The bug this file guards: picking a model must move the sub label off the
  // flagship default, even though nothing is active yet.
  test("pending pick (no active) → sub label follows the pick, tagged key not active", () => {
    const r = resolveProviderRow(claude, null, "claude-sonnet-4");
    expect(r.shownModel).toBe("claude-sonnet-4");
    expect(r.shownLabel).toBe("Claude Sonnet 4");
    expect(r.isActive).toBe(false);
  });

  test("pending pick overrides a different active model, and is not 'active'", () => {
    const r = resolveProviderRow(claude, "claude-opus-4", "claude-haiku-4");
    expect(r.shownLabel).toBe("Claude Haiku 4");
    expect(r.isActive).toBe(false);
  });

  test("unknown shown model falls back to the first model's label", () => {
    const r = resolveProviderRow(claude, "gone-model", null);
    expect(r.shownModel).toBe("gone-model");
    expect(r.shownLabel).toBe("Claude Opus 4");
  });

  test("empty model list falls back to the brand label", () => {
    const r = resolveProviderRow({ defaultModel: "", label: "Grok", models: [] }, null, null);
    expect(r.shownLabel).toBe("Grok");
  });
});
