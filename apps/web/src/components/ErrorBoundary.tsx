// SK-WEB-001 — render-time recovery for every island; paired with `Base.astro`'s pre-hydration `boot-fallback` for crashes before React mounts.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "../lib/error-report";

interface ErrorBoundaryProps {
  children: ReactNode;
  // Surface tag in the error report so a CreateForm crash is distinguishable from a ChatPanel crash without parsing stack traces.
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
