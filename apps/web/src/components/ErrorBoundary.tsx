// React error boundary for every island in `apps/web` (SK-WEB-001).
//
// An unhandled throw inside a `client:load` / `client:only` island
// unmounts the whole island and leaves an empty `<main>` with no
// recovery affordance. This wrapper renders a small fallback panel
// instead: a one-sentence reason, Reload + Sign-out actions, and a
// "what was on screen before" hint so the user still has a way out.
//
// Pair this with `Base.astro`'s pre-hydration `boot-fallback` block —
// that one catches `error` / `unhandledrejection` for crashes that
// happen BEFORE React mounts (chunk-load failures, top-level eval
// errors). ErrorBoundary catches throws DURING render / lifecycle.
// Together: every reachable JS failure produces a visible UI, not a
// blank screen.
//
// Reporting: errors are logged to the browser console (preserving the
// stack) and POSTed best-effort to `/v1/errors/web` so they show up
// in the same observability pipeline as server errors. The POST is
// fire-and-forget and never blocks the fallback render.

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  // Optional surface tag — included in the error report so we can
  // distinguish a CreateForm crash from a ChatPanel crash without
  // parsing stack traces.
  surface?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[nlqdb] island crashed", error, info.componentStack);
    try {
      void fetch("/v1/errors/web", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          surface: this.props.surface ?? "unknown",
          message: error.message,
          stack: error.stack ?? null,
          componentStack: info.componentStack ?? null,
          href: typeof window !== "undefined" ? window.location.href : null,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
        keepalive: true,
      });
    } catch {
      // best-effort — never let reporting itself blow up the fallback.
    }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="err-boundary" role="alert">
        <div className="err-boundary__card">
          <h2 className="err-boundary__title">Something broke on this page.</h2>
          <p className="err-boundary__lede">
            The error has been recorded. Reload to recover; if it persists, sign out and back in.
          </p>
          <p className="err-boundary__reason">{this.state.error.message || "Unknown error."}</p>
          <div className="err-boundary__actions">
            <button
              type="button"
              className="btn btn--accent"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <a className="btn" href="/auth/sign-out">
              Sign out
            </a>
          </div>
        </div>
      </div>
    );
  }
}
