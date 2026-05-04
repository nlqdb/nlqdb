// Tiny LogSnag emitter stub for client-side product events. The
// real pipeline is the events-worker fan-out (`packages/events`,
// `apps/events-worker`); the marketing copy + chat copy buttons
// fire `home.snippet_copied` to LogSnag for funnel analytics
// (SK-WEB-003, SK-WEB-007).
//
// This is intentionally a no-op when the global `__nlqdb_logsnag`
// hook is absent — the marketing site already wires this up via a
// late-bound script tag, and dev / preview builds shouldn't fail
// the chat just because LogSnag is offline.

declare global {
  interface Window {
    __nlqdb_logsnag?: (event: string, props?: Record<string, unknown>) => void;
  }
}

export function emit(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.__nlqdb_logsnag?.(event, props);
  } catch {
    // Never let an analytics failure interrupt the user-visible
    // flow. GLOBAL-012 — errors are one sentence with the next
    // action; analytics has no next action.
  }
}
