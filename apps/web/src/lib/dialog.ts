// Reusable building blocks for modal dialogs (`SK-APIKEYS-012`,
// `SK-HDC-016`). Three dialogs share the same Escape-to-close, Tab
// focus-trap, and return-focus-on-unmount pattern; without a shared
// hook the logic drifts and each copy needs its own audit.

import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'input,select,textarea,button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

// Captures `document.activeElement` at mount and re-focuses it on
// unmount. `fallback` runs only when the original element was
// detached (e.g. the trigger row got removed after a successful
// destructive action). The fallback is held in a ref so callers can
// pass an inline arrow without re-triggering the effect.
export function useRestoreFocusOnUnmount(fallback?: () => HTMLElement | null): void {
  const triggerRef = useRef<HTMLElement | null>(null);
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  if (triggerRef.current === null && typeof document !== "undefined") {
    triggerRef.current = document.activeElement as HTMLElement | null;
  }
  useEffect(() => {
    const trigger = triggerRef.current;
    return () => {
      if (trigger && document.body.contains(trigger)) {
        trigger.focus();
      } else {
        fallbackRef.current?.()?.focus();
      }
    };
  }, []);
}

// Window-scoped Escape + Tab handler bound to a dialog container.
// Escape calls `onEscape` when `escapeEnabled` is true (callers gate
// on `submitting` / "already-minted" so an in-flight mutation isn't
// orphaned). Tab walks the dialog's focusable descendants and wraps
// at both ends. Querying focusable elements at keypress time (rather
// than caching at mount) keeps the trap correct when dialog content
// swaps between pre- and post-mint render branches.
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  options: {
    escapeEnabled?: boolean;
    onEscape?: () => void;
  } = {},
): void {
  const { escapeEnabled = true, onEscape } = options;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (escapeEnabled && onEscape) onEscape();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref, escapeEnabled, onEscape]);
}
