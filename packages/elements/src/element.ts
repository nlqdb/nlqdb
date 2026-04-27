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

export class NlqDataElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["goal", "db", "query", "api-key", "template", "refresh", "data-demo"];
  }

  private refreshHandle: number | null = null;

  connectedCallback(): void {
    this.update();
    this.setupRefresh();
  }

  disconnectedCallback(): void {
    this.teardownRefresh();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.update();
      this.setupRefresh();
    }
  }

  // v0: renders demo fixtures synchronously when `data-demo` is set.
  // Slice 10 swaps this for a real `POST /v1/ask` call (with anonymous
  // mode + `pk_live_*` paths) — the method signature stays the same so
  // refresh / lifecycle code doesn't change.
  private update(): void {
    const template = this.getAttribute("template") ?? "table";
    const demoKey = this.getAttribute("data-demo");

    if (demoKey) {
      this.innerHTML = renderTemplate(template, demoDataFor(demoKey));
      return;
    }
    this.innerHTML = PENDING_HTML;
  }

  private setupRefresh(): void {
    this.teardownRefresh();
    const ms = parseRefresh(this.getAttribute("refresh"));
    if (ms === null) return;
    this.refreshHandle = window.setInterval(() => this.update(), ms);
  }

  private teardownRefresh(): void {
    if (this.refreshHandle !== null) {
      window.clearInterval(this.refreshHandle);
      this.refreshHandle = null;
    }
  }
}
