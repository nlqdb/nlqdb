// Cmd+K command palette overlay. Keyboard-first per SK-WEB-005:
// arrow keys move the selection; Enter runs the action; Escape
// closes. Filtering is substring-match on label so the user can
// type "snip" → Copy embed snippet without learning a vocabulary.
//
// All keyboard navigation is handled on the search input (the
// natural keyboard focus inside the palette). Mouse fallback
// uses a <button> per row so screen readers and keyboard-only
// users still hit the same tabbable affordances.

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

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
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
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
        />
        <ul className="palette__list">
          {filtered.length === 0 ? <li className="palette__empty">No commands match.</li> : null}
          {filtered.map((action, idx) => (
            <li key={action.id} className="palette__item-wrap">
              <button
                type="button"
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
