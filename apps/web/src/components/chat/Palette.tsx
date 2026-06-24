// Cmd+K command palette overlay. Keyboard-first per SK-WEB-005:
// arrow keys move the selection; Enter runs the action; Escape
// closes. Filtering is substring-match on label so the user can
// type "snip" → Copy embed snippet without learning a vocabulary.
//
// All keyboard navigation is handled on the search input (the
// natural keyboard focus inside the palette), exposed to assistive
// tech as a WAI-ARIA combobox: the input keeps focus and
// `aria-activedescendant` names the highlighted option in the
// listbox below, so a screen reader announces each command as the
// user arrows through it. Each row is still a <button> so mouse and
// keyboard-only users keep a real, tabbable click target.

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { nextHighlight, paletteOptionId } from "../../lib/palette-nav";

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};

interface PaletteProps {
  open: boolean;
  actions: PaletteAction[];
  onClose: () => void;
}

export default function Palette({ open, actions, onClose }: PaletteProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  // Reset state every time the palette opens. Without this, an
  // earlier query lingers and the highlight points at a filtered
  // index that no longer exists.
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      // The autoFocus prop alone misses the second-open path —
      // React doesn't re-fire it on a re-render with the same
      // element instance. Imperative focus is the reliable path.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Clamp the highlight so a shrinking filtered list never points
  // past the end.
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered.length, highlight]);

  if (!open) return null;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => nextHighlight("ArrowDown", h, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => nextHighlight("ArrowUp", h, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const action = filtered[highlight];
      if (action) {
        action.run();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="palette" role="dialog" aria-label="Command palette" aria-modal="true">
      <button
        type="button"
        className="palette__scrim"
        onClick={onClose}
        aria-label="Close command palette"
      />
      <div className="palette__panel">
        <input
          ref={inputRef}
          className="palette__input"
          placeholder="Type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          // WAI-ARIA combobox: the input owns the listbox and points at
          // the highlighted option so screen readers announce the active
          // command as the user arrows through it (the visual highlight
          // alone is silent to AT).
          role="combobox"
          aria-controls="palette-listbox"
          aria-expanded={filtered.length > 0}
          aria-autocomplete="list"
          aria-activedescendant={filtered.length > 0 ? paletteOptionId(highlight) : undefined}
        />
        <div id="palette-listbox" role="listbox" aria-label="Commands" className="palette__list">
          {filtered.length === 0 ? <div className="palette__empty">No commands match.</div> : null}
          {filtered.map((action, idx) => (
            <div key={action.id} className="palette__item-wrap">
              <button
                type="button"
                id={paletteOptionId(idx)}
                role="option"
                aria-selected={idx === highlight}
                className="palette__item"
                data-highlight={idx === highlight || undefined}
                onMouseEnter={() => setHighlight(idx)}
                onFocus={() => setHighlight(idx)}
                onClick={() => {
                  action.run();
                  onClose();
                }}
              >
                <span className="palette__item-label">{action.label}</span>
                {action.hint ? <span className="palette__item-hint">{action.hint}</span> : null}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
