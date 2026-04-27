import { ABORT_SENTINEL, type AskFailure, fetchAsk } from "./fetch.ts";
import { parseRefresh } from "./parse.ts";
import { renderState } from "./render.ts";

// Production endpoint for the public hosted API. Override with the
// `endpoint` attribute when self-hosting or for preview deploys.
const DEFAULT_ENDPOINT = "https://app.nlqdb.com/v1/ask";

// Floor on the polling interval. Background tabs throttle to ~1s
// already; `refresh="1ms"` in the foreground is pure CPU burn with no
// upside. Anything below this clamps + warns once.
const MIN_REFRESH_MS = 250;

export type NlqDataLoadDetail = {
  rows: number;
  cached: boolean;
};

export type NlqDataErrorDetail = AskFailure;

export class NlqDataElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["goal", "db", "query", "api-key", "endpoint", "template", "refresh"];
  }

  private refreshHandle: number | null = null;
  private updateScheduled = false;
  private lastRenderedHtml: string | null = null;
  private inflight: AbortController | null = null;

  connectedCallback(): void {
    this.scheduleUpdate();
    this.setupRefresh();
  }

  disconnectedCallback(): void {
    this.teardownRefresh();
    this.cancelInflight();
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.scheduleUpdate();
    this.setupRefresh();
  }

  // Coalesces multiple synchronous attribute changes into one fetch.
  // Without this, setting `goal`, `db`, `template` in sequence would
  // trigger three POSTs in flight.
  private scheduleUpdate(): void {
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    queueMicrotask(() => {
      this.updateScheduled = false;
      void this.update();
    });
  }

  private cancelInflight(): void {
    if (this.inflight) {
      this.inflight.abort();
      this.inflight = null;
    }
  }

  private async update(): Promise<void> {
    const goal = (this.getAttribute("goal") ?? this.getAttribute("query") ?? "").trim();
    const dbId = (this.getAttribute("db") ?? "").trim();
    const apiKey = this.getAttribute("api-key");
    const endpoint = this.getAttribute("endpoint") ?? DEFAULT_ENDPOINT;
    const template = this.getAttribute("template") ?? "table";

    if (!goal) {
      this.cancelInflight();
      this.renderHtml(renderState({ kind: "idle", reason: "no-goal" }, template));
      return;
    }
    if (!dbId) {
      this.cancelInflight();
      this.renderHtml(renderState({ kind: "idle", reason: "no-db" }, template));
      return;
    }

    // Stale request from a previous attribute set wouldn't change the
    // outcome but would race the new render — cancel it.
    this.cancelInflight();
    const controller = new AbortController();
    this.inflight = controller;

    // Show pending only on the first fetch (or after an idle render).
    // Refresh polls keep the previous render visible until the next
    // one resolves — avoids flicker every interval.
    if (this.lastRenderedHtml === null || this.lastRenderedHtml.includes("nlq-pending")) {
      this.renderHtml(renderState({ kind: "loading" }, template));
    }

    const outcome = await fetchAsk({
      endpoint,
      goal,
      dbId,
      apiKey,
      signal: controller.signal,
    });
    if (outcome === ABORT_SENTINEL || controller.signal.aborted) return;
    this.inflight = null;

    if (outcome.ok) {
      this.renderHtml(renderState({ kind: "success", data: outcome.data }, template));
      this.dispatchEvent(
        new CustomEvent<NlqDataLoadDetail>("nlq-data:load", {
          detail: { rows: outcome.data.rowCount, cached: outcome.data.cached },
          bubbles: true,
          composed: true,
        }),
      );
    } else {
      this.renderHtml(renderState({ kind: "error", failure: outcome.failure }, template));
      this.dispatchEvent(
        new CustomEvent<NlqDataErrorDetail>("nlq-data:error", {
          detail: outcome.failure,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  // Skip the DOM swap when nothing changed — preserves text
  // selection, focus, and any third-party listeners attached to
  // descendants. Critical at sub-second refresh rates.
  private renderHtml(html: string): void {
    if (html !== this.lastRenderedHtml) {
      this.innerHTML = html;
      this.lastRenderedHtml = html;
    }
  }

  // Self-rescheduling timeout — the next timer arms only after the
  // current `update()` completes. Prevents queueing in-flight requests
  // when the API runs slower than the refresh interval.
  private setupRefresh(): void {
    this.teardownRefresh();
    const raw = this.getAttribute("refresh");
    if (raw === null) return;

    const ms = parseRefresh(raw);
    if (ms === null) {
      console.warn(
        `[nlq-data] refresh="${raw}" is not parseable; expected "60s", "5m", "500ms", or a plain integer.`,
      );
      return;
    }
    if (ms < MIN_REFRESH_MS) {
      console.warn(
        `[nlq-data] refresh="${raw}" clamped to ${MIN_REFRESH_MS}ms (minimum to avoid CPU burn).`,
      );
    }
    const effective = Math.max(ms, MIN_REFRESH_MS);
    this.refreshHandle = window.setTimeout(() => {
      this.refreshHandle = null;
      void this.update();
      this.setupRefresh();
    }, effective);
  }

  private teardownRefresh(): void {
    if (this.refreshHandle !== null) {
      window.clearTimeout(this.refreshHandle);
      this.refreshHandle = null;
    }
  }
}
