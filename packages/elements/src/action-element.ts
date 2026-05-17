// `<nlq-action>` — write counterpart to `<nlq-data>`. Click → preview
// hop, render diff, Apply → commit hop. See SK-ELEM-010..013.

import { appendFormContext, type FormEntry } from "./action-goal.ts";
import { type NlqActionState, renderActionState } from "./action-render.ts";
import { type AskDiff, type AskFailure, fetchAsk } from "./fetch.ts";

const DEFAULT_ENDPOINT = "https://app.nlqdb.com/v1/ask";
const DEFAULT_LABEL = "Submit";

const FETCH_ATTRS = new Set(["goal", "db", "api-key", "endpoint"]);

export type NlqActionSuccessDetail = {
  rowCount: number;
  diff: AskDiff;
};

export type NlqActionConfirmDetail = {
  diff: AskDiff;
};

export type NlqActionErrorDetail = AskFailure;

export class NlqActionElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["goal", "db", "api-key", "endpoint", "form", "label", "on-success"];
  }

  private state: NlqActionState = { kind: "idle", label: DEFAULT_LABEL };
  private inflight: AbortController | null = null;
  private clickHandler: ((e: Event) => void) | null = null;
  // Snapshotted so the diff the user saw is the diff they confirm.
  private previewGoal: string | null = null;

  connectedCallback(): void {
    if (!this.hasAttribute("role")) this.setAttribute("role", "group");
    if (!this.hasAttribute("aria-live")) this.setAttribute("aria-live", "polite");
    this.state = { kind: "idle", label: this.resolveLabel() };
    this.commit();
    this.clickHandler = (e) => this.handleClick(e);
    this.addEventListener("click", this.clickHandler);
  }

  disconnectedCallback(): void {
    if (this.clickHandler) {
      this.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
    this.cancelInflight();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.isConnected) return;
    if (oldValue === newValue) return;
    if (name === "label") {
      if (this.state.kind === "idle") {
        this.state = { kind: "idle", label: this.resolveLabel() };
        this.commit();
      }
      return;
    }
    if (FETCH_ATTRS.has(name) && this.state.kind === "confirm") {
      this.previewGoal = null;
      this.state = { kind: "idle", label: this.resolveLabel() };
      this.commit();
    }
  }

  private resolveLabel(): string {
    const explicit = this.getAttribute("label");
    if (explicit?.trim()) return explicit.trim();
    const slot = (this.textContent ?? "").trim();
    return slot || DEFAULT_LABEL;
  }

  private resolveForm(): HTMLFormElement | null {
    const formId = this.getAttribute("form");
    if (formId) {
      const root = this.getRootNode() as Document | ShadowRoot;
      const el = "getElementById" in root ? root.getElementById(formId) : null;
      return el instanceof HTMLFormElement ? el : null;
    }
    return this.closest("form");
  }

  private buildGoal(): string {
    const goal = (this.getAttribute("goal") ?? "").trim();
    const form = this.resolveForm();
    const entries: FormEntry[] = [];
    if (form) {
      // Skip File values — multipart upload is out of scope for v0.1.
      for (const [key, value] of new FormData(form).entries()) {
        if (typeof value === "string") entries.push([key, value]);
      }
    }
    return appendFormContext(goal, entries);
  }

  private cancelInflight(): void {
    if (this.inflight) {
      this.inflight.abort();
      this.inflight = null;
    }
  }

  private async handleClick(e: Event): Promise<void> {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const action = target.closest("[data-action]");
    // `closest` walks past the host; restrict to our subtree so a parent can't hijack.
    if (action instanceof HTMLElement && this.contains(action)) {
      const verb = action.dataset["action"];
      if (verb === "apply") {
        e.preventDefault();
        await this.applyDiff();
        return;
      }
      if (verb === "cancel" || verb === "reset" || verb === "retry") {
        e.preventDefault();
        this.previewGoal = null;
        this.state = { kind: "idle", label: this.resolveLabel() };
        this.commit();
        return;
      }
    }
    if (this.state.kind === "idle" || this.state.kind === "error") {
      e.preventDefault();
      await this.preview();
    }
  }

  private validatePreview(): { goal: string; dbId: string } | null {
    const dbId = (this.getAttribute("db") ?? "").trim();
    if (!dbId) {
      this.fail({ kind: "api", status: 0, error: "db_required" });
      return null;
    }
    const goal = this.buildGoal();
    if (!goal) {
      this.fail({ kind: "api", status: 0, error: "goal_required" });
      return null;
    }
    return { goal, dbId };
  }

  private async preview(): Promise<void> {
    const params = this.validatePreview();
    if (!params) return;

    this.cancelInflight();
    const controller = new AbortController();
    this.inflight = controller;

    this.state = { kind: "previewing", label: this.resolveLabel() };
    this.commit();

    const endpoint = this.getAttribute("endpoint") ?? DEFAULT_ENDPOINT;
    const apiKey = this.getAttribute("api-key") ?? undefined;

    let outcome: Awaited<ReturnType<typeof fetchAsk>>;
    try {
      outcome = await fetchAsk({
        endpoint,
        goal: params.goal,
        dbId: params.dbId,
        apiKey,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      // Surface unexpected throws as a network failure so the user always gets a retry path.
      this.fail({
        kind: "network",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    if (controller.signal.aborted) return;
    this.inflight = null;

    if (!outcome.ok) {
      this.fail(outcome.failure);
      return;
    }

    const data = outcome.data;
    if (data.requires_confirm && data.diff) {
      this.previewGoal = params.goal;
      this.state = { kind: "confirm", diff: data.diff, label: this.resolveLabel() };
      this.commit();
      this.dispatchEvent(
        new CustomEvent<NlqActionConfirmDetail>("nlq-action:confirm-required", {
          detail: { diff: data.diff },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    // No confirm needed (read SQL or already committed) — render success rather than swallow silently.
    this.applyCompleted(data.rowCount, data.diff ?? null);
  }

  private async applyDiff(): Promise<void> {
    if (this.state.kind !== "confirm") return;
    const dbId = (this.getAttribute("db") ?? "").trim();
    const goal = this.previewGoal;
    if (!dbId || !goal) return;
    const diff = this.state.diff;

    this.cancelInflight();
    const controller = new AbortController();
    this.inflight = controller;

    this.state = { kind: "applying", diff, label: this.resolveLabel() };
    this.commit();

    const endpoint = this.getAttribute("endpoint") ?? DEFAULT_ENDPOINT;
    const apiKey = this.getAttribute("api-key") ?? undefined;

    let outcome: Awaited<ReturnType<typeof fetchAsk>>;
    try {
      outcome = await fetchAsk({
        endpoint,
        goal,
        dbId,
        apiKey,
        confirm: true,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      this.fail({
        kind: "network",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    if (controller.signal.aborted) return;
    this.inflight = null;

    if (!outcome.ok) {
      this.fail(outcome.failure);
      return;
    }
    this.applyCompleted(outcome.data.rowCount, diff);
  }

  private applyCompleted(rowCount: number, diff: AskDiff | null): void {
    this.previewGoal = null;
    this.state = { kind: "success", rowCount, label: this.resolveLabel() };
    this.commit();
    if (diff) {
      this.dispatchEvent(
        new CustomEvent<NlqActionSuccessDetail>("nlq-action:success", {
          detail: { rowCount, diff },
          bubbles: true,
          composed: true,
        }),
      );
    }
    this.runOnSuccess();
  }

  private fail(failure: AskFailure): void {
    this.inflight = null;
    this.state = { kind: "error", failure, label: this.resolveLabel() };
    this.commit();
    this.dispatchEvent(
      new CustomEvent<NlqActionErrorDetail>("nlq-action:error", {
        detail: failure,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private commit(): void {
    // `[data-state]` on the host gives CSS + analytics a state hook without subtree queries.
    this.dataset["state"] = this.state.kind;
    this.innerHTML = renderActionState(this.state);
  }

  private runOnSuccess(): void {
    const directive = (this.getAttribute("on-success") ?? "").trim();
    if (!directive) return;
    if (directive === "reset") {
      this.resolveForm()?.reset();
      return;
    }
    if (directive === "reload") {
      if (typeof window === "undefined") return;
      try {
        window.location.reload();
      } catch (err) {
        // Cross-origin iframes throw SecurityError; never crash a successful write.
        console.warn(`[nlq-action] on-success="reload" failed:`, err);
      }
      return;
    }
    if (directive.startsWith("refresh:")) {
      const selector = directive.slice("refresh:".length).trim();
      if (!selector || typeof document === "undefined") return;
      let matches: NodeListOf<Element>;
      try {
        matches = document.querySelectorAll(selector);
      } catch {
        console.warn(`[nlq-action] on-success="${directive}" selector is invalid; ignoring.`);
        return;
      }
      // Duck-typed `.refresh()` decouples action from `<nlq-data>`; per-node try/catch
      // so one throwing match doesn't skip the rest.
      for (const node of matches) {
        const fn = (node as { refresh?: () => void }).refresh;
        if (typeof fn !== "function") continue;
        try {
          fn.call(node);
        } catch (err) {
          console.warn(`[nlq-action] refresh of ${selector} match threw:`, err);
        }
      }
      return;
    }
    console.warn(
      `[nlq-action] on-success="${directive}" is not recognised; expected "reset", "reload", or "refresh:<selector>".`,
    );
  }
}
