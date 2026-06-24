// Pure keyboard-navigation logic for the Cmd+K command palette
// (SK-WEB-005). Kept out of the React component so the clamp/bounds
// invariants are unit-testable without a DOM, and so the option-id
// scheme that drives `aria-activedescendant` has one source of truth
// shared by the input and the rendered options.

export type NavKey = "ArrowDown" | "ArrowUp";

// Next highlighted index given an arrow key, the current index, and
// the number of visible options. ArrowDown moves toward the end and
// stops there; ArrowUp moves toward the start and stops at 0. With no
// options the highlight stays at 0 so the empty-list state is inert.
export function nextHighlight(key: NavKey, current: number, length: number): number {
  if (length <= 0) return 0;
  const max = length - 1;
  // Pull `current` back into range first: a narrowing filter can leave
  // it past the new end, and we must never step from an out-of-bounds
  // index.
  const here = Math.min(Math.max(0, current), max);
  return key === "ArrowDown" ? Math.min(max, here + 1) : Math.max(0, here - 1);
}

// Stable DOM id for the option at `index`. Referenced by the input's
// `aria-activedescendant` so assistive tech announces the highlighted
// command as the user arrows through the list (WAI-ARIA combobox).
export function paletteOptionId(index: number): string {
  return `palette-option-${index}`;
}
