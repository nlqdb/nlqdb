// React error boundary for every island in `apps/web` (SK-WEB-001).
//
// An unhandled throw inside a `client:load` / `client:only` island
// unmounts the whole island and leaves an empty `<main>` with no
// recovery affordance. This wrapper renders a small fallback panel
// instead with Reload + Sign-out actions.
//
// Pair this with `Base.astro`'s pre-hydration `boot-fallback` block —
// that one catches `error` / `unhandledrejection` for crashes that
// happen BEFORE React mounts (chunk-load failures, top-level eval
// errors). ErrorBoundary catches throws DURING render / lifecycle.
// We also set `window.__nlqdbBooted = true` on mount so the
// pre-hydration handler stops revealing its panel for post-React
// errors — those belong to the boundary, not the boot-fallback.
//
// Reports go through `lib/error-report.ts` so the boundary and the
// pre-hydration handler share one payload shape + dedup + abuse
// safeguards.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "../lib/error-report";

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

declare global {
  interface Window {
    __nlqdbBooted?: boolean;
  }
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  componentDidMount(): void {
    if (typeof window !== "undefined") {
      window.__nlqdbBooted = true;
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[nlqdb] island crashed", error, info.componentStack);
    reportClientError({
      surface: this.props.surface ?? "unknown",
      message: error.message || "Unknown error.",
      stack: error.stack ?? null,
      componentStack: info.componentStack ?? null,
      href: typeof window !== "undefined" ? window.location.href : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
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
