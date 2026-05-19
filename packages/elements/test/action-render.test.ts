import { describe, expect, it } from "vitest";
import { type NlqActionState, renderActionState } from "../src/action-render.ts";
import type { AskDiff } from "../src/fetch.ts";

const diff: AskDiff = {
  verb: "INSERT",
  table: "orders",
  affectedRows: 1,
  summary: "Insert 1 row into orders",
};

describe("renderActionState — idle", () => {
  it("renders the slot label as a clickable button", () => {
    const html = renderActionState({ kind: "idle", label: "Submit" });
    expect(html).toContain("<button");
    expect(html).toContain("nlq-action-btn");
    expect(html).toContain('data-action-state="idle"');
    expect(html).toContain(">Submit<");
    expect(html).not.toContain("disabled");
  });

  it("escapes HTML in the label", () => {
    const html = renderActionState({ kind: "idle", label: "<img>Submit</img>" });
    expect(html).toContain("&lt;img&gt;Submit&lt;/img&gt;");
    expect(html).not.toContain("<img>");
  });
});

describe("renderActionState — previewing", () => {
  it("disables the button while the preview hop is in flight", () => {
    const html = renderActionState({ kind: "previewing", label: "Submit" });
    expect(html).toContain("disabled");
    expect(html).toContain('data-action-state="previewing"');
    expect(html).toContain("Preparing…");
  });
});

describe("renderActionState — confirm", () => {
  it("renders the diff summary, verb, table, row count, and Apply/Cancel buttons", () => {
    const html = renderActionState({ kind: "confirm", diff, label: "Submit" });
    expect(html).toContain("Insert 1 row into orders");
    expect(html).toContain("INSERT");
    expect(html).toContain("orders");
    expect(html).toContain("1 row");
    expect(html).toContain('data-action="apply"');
    expect(html).toContain('data-action="cancel"');
    expect(html).toContain('data-action-state="confirm"');
  });

  it("uses the plural row form for affectedRows != 1", () => {
    const html = renderActionState({
      kind: "confirm",
      diff: { ...diff, affectedRows: 5, summary: "Update 5 rows" },
      label: "Submit",
    });
    expect(html).toContain("5 rows");
  });

  it("escapes hostile diff strings to prevent HTML injection", () => {
    const hostile: AskDiff = {
      verb: "DELETE",
      table: "orders<script>x</script>",
      affectedRows: 1,
      summary: "<img src=x onerror=1>",
    };
    const html = renderActionState({ kind: "confirm", diff: hostile, label: "Submit" });
    expect(html).not.toContain("<script>x</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("autofocus is on Apply, not Cancel — keyboard-driven users land on the confirm action", () => {
    const html = renderActionState({ kind: "confirm", diff, label: "Submit" });
    const apply = html.indexOf('data-action="apply"');
    const cancel = html.indexOf('data-action="cancel"');
    const autofocus = html.indexOf("autofocus");
    expect(autofocus).toBeGreaterThan(cancel);
    expect(autofocus).toBeLessThan(apply + 'data-action="apply"'.length + 50);
  });
});

describe("renderActionState — applying", () => {
  it("shows an aria-busy state while the commit hop is in flight", () => {
    const html = renderActionState({ kind: "applying", diff, label: "Submit" });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Applying");
  });
});

describe("renderActionState — success", () => {
  it("reports row count + offers a reset button labelled with the original action", () => {
    const html = renderActionState({ kind: "success", rowCount: 1, label: "Submit" });
    expect(html).toContain("Done");
    expect(html).toContain("1 row");
    expect(html).toContain('data-action="reset"');
    expect(html).toContain(">Submit<");
  });

  it("pluralizes rows when rowCount != 1", () => {
    const html = renderActionState({ kind: "success", rowCount: 3, label: "Submit" });
    expect(html).toContain("3 rows");
  });
});

describe("renderActionState — error", () => {
  function renderError(state: NlqActionState): string {
    return renderActionState(state);
  }

  it("renders a network failure with a retry button", () => {
    const html = renderError({
      kind: "error",
      failure: { kind: "network", message: "Failed to fetch" },
      label: "Submit",
    });
    expect(html).toContain("Network error");
    expect(html).toContain("Failed to fetch");
    expect(html).toContain('data-action="retry"');
    expect(html).toContain('data-kind="network"');
  });

  it("renders an auth failure with a sign-in hint", () => {
    const html = renderError({
      kind: "error",
      failure: { kind: "auth", status: 401 },
      label: "Submit",
    });
    expect(html).toContain("Sign in required");
    expect(html).toContain('data-kind="auth"');
  });

  it("renders structured rate-limit errors with count/limit", () => {
    const html = renderError({
      kind: "error",
      failure: {
        kind: "api",
        status: 429,
        error: { status: "rate_limited", limit: 10, count: 11 },
      },
      label: "Submit",
    });
    expect(html).toContain("Rate limit reached");
    expect(html).toContain("11 of 10");
  });

  it("renders bare-string API errors verbatim", () => {
    const html = renderError({
      kind: "error",
      failure: { kind: "api", status: 400, error: "goal_required" },
      label: "Submit",
    });
    expect(html).toContain("Error 400");
    expect(html).toContain("goal_required");
  });

  it("escapes hostile error messages", () => {
    const html = renderError({
      kind: "error",
      failure: { kind: "network", message: "<script>alert(1)</script>" },
      label: "Submit",
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders the feature_gated CTA without a retry button (SK-ELEM-014)", () => {
    const html = renderError({
      kind: "error",
      failure: {
        kind: "api",
        status: 403,
        error: {
          status: "feature_gated",
          message: "nlqdb is pre-alpha — join the waitlist for early access.",
          action: "Join the waitlist",
          waitlist_url: "https://nlqdb.com/#waitlist",
          gate: {
            bird_accuracy: 0.318,
            spider_accuracy: null,
            bird_target: 0.65,
            spider_target: 0.75,
            measured_at: "2026-05-18T22:42:29.917Z",
          },
        },
      },
      label: "Submit",
    });
    expect(html).toContain('data-kind="gated"');
    expect(html).toContain('href="https://nlqdb.com/#waitlist"');
    expect(html).toContain("Join the waitlist");
    expect(html).not.toContain('data-action="retry"');
  });
});
