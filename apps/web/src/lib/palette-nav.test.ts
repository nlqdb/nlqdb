import { describe, expect, it } from "bun:test";
import { nextHighlight, paletteOptionId } from "./palette-nav";

// The Cmd+K palette (SK-WEB-005) is keyboard-first: arrow keys move a
// highlight that drives `aria-activedescendant`. The highlight must
// always stay in bounds — a value past the end would point
// aria-activedescendant at a non-existent option id and announce
// nothing to assistive tech.
describe("nextHighlight", () => {
  it("ArrowDown advances toward the end", () => {
    expect(nextHighlight("ArrowDown", 0, 3)).toBe(1);
    expect(nextHighlight("ArrowDown", 1, 3)).toBe(2);
  });

  it("ArrowDown clamps at the last option", () => {
    expect(nextHighlight("ArrowDown", 2, 3)).toBe(2);
  });

  it("ArrowUp moves toward the start", () => {
    expect(nextHighlight("ArrowUp", 2, 3)).toBe(1);
  });

  it("ArrowUp clamps at 0", () => {
    expect(nextHighlight("ArrowUp", 0, 3)).toBe(0);
  });

  it("stays at 0 when the filtered list is empty", () => {
    expect(nextHighlight("ArrowDown", 0, 0)).toBe(0);
    expect(nextHighlight("ArrowUp", 0, 0)).toBe(0);
  });

  it("recovers when the current index is already past a shrunken list", () => {
    // A narrowing filter can leave `current` past the new end; the next
    // ArrowUp/Down must land back inside [0, length). Clamped to the
    // last index (1), ArrowDown stays there and ArrowUp steps to 0.
    expect(nextHighlight("ArrowDown", 9, 2)).toBe(1);
    expect(nextHighlight("ArrowUp", 9, 2)).toBe(0);
  });
});

describe("paletteOptionId", () => {
  it("is stable and unique per index", () => {
    expect(paletteOptionId(0)).toBe("palette-option-0");
    expect(paletteOptionId(0)).toBe(paletteOptionId(0));
    expect(paletteOptionId(1)).not.toBe(paletteOptionId(0));
  });
});
