import { demoDataFor } from "./demo-data.ts";
import { parseRefresh } from "./parse.ts";
import { renderTemplate } from "./templates.ts";

// Fallback markup when the element has no `data-demo` and the live
// `/v1/ask` integration isn't wired yet. The wording is intentionally
// honest about which slice unblocks it — a curious developer
// inspecting the DOM lands on the right next step rather than a
// generic "loading…" that never resolves.
const PENDING_HTML =
  '<div class="nlq-pending">nlqdb: live data lands in Slice 10. Set <code>data-demo</code> for now.</div>';

// Floor on the polling interval. Background tabs throttle to ~1s
// already; `refresh="1ms"` in the foreground is pure CPU burn with no
// upside. Anything below this clamps + warns once.
const MIN_REFRESH_MS = 250;

export type NlqDataLoadDetail = {
  source: "demo" | "pending";
  rows: number;
};

export class NlqDataElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["goal", "db", "query", "api-key", "template", "refresh", "data-demo"];
  }

  private refreshHandle: number | null = null;
  private updateScheduled = false;
  private lastRenderedHtml: string | null = null;

  connectedCallback(): void {
    this.scheduleUpdate();
    this.setupRefresh();
  }

  disconnectedCallback(): void {
    this.teardownRefresh();
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.scheduleUpdate();
    this.setupRefresh();
  }

  // Coalesces multiple synchronous attribute changes into one render.
  // Without this, setting `goal`, `template`, `db` in sequence would
  // trigger three full renders (and three fetches in Slice 10).
  private scheduleUpdate(): void {
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    queueMicrotask(() => {
      this.updateScheduled = false;
      this.update();
    });
  }

  // v0: renders demo fixtures synchronously when `data-demo` is set.
  // Slice 10 swaps this for a real `POST /v1/ask` call (with anonymous
  // mode + `pk_live_*` paths) — the method signature stays the same so
  // refresh / lifecycle code doesn't change.
  private update(): void {
    const template = this.getAttribute("template") ?? "table";
    const demoKey = this.getAttribute("data-demo");

    let nextHtml: string;
    let detail: NlqDataLoadDetail;
    if (demoKey) {
      const rows = demoDataFor(demoKey);
      nextHtml = renderTemplate(template, rows);
      detail = { source: "demo", rows: rows.length };
    } else {
      nextHtml = PENDING_HTML;
      detail = { source: "pending", rows: 0 };
    }

    // Skip the DOM swap when nothing changed — preserves text
    // selection, focus, and any third-party listeners attached to
    // descendants. Critical at sub-second refresh rates.
    if (nextHtml !== this.lastRenderedHtml) {
      this.innerHTML = nextHtml;
      this.lastRenderedHtml = nextHtml;
    }

    // Lets consumers wire analytics or chained UI without subclassing.
    // Slice 10 adds a sibling `nlq-data:error` event for failed
    // fetches; the `:load` shape stays additive (new keys, never
    // removed).
    this.dispatchEvent(
      new CustomEvent("nlq-data:load", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  // Self-rescheduling timeout — the next timer arms only after the
  // current `update()` completes. Tolerates Slice 10's async fetch
  // without queueing in-flight requests if the API runs slower than
  // the refresh interval.
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
      this.update();
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
