import { describe, expect, it } from "vitest";
import type { AskSuccess } from "../src/fetch.ts";
import { errorHtml, renderState } from "../src/render.ts";

const success: AskSuccess = {
  status: "ok",
  cached: false,
  sql: "SELECT * FROM orders",
  rows: [
    { customer: "Maya", drink: "latte" },
    { customer: "Jordan", drink: "flat white" },
  ],
  rowCount: 2,
};

describe("renderState — idle", () => {
  it("prompts for the missing goal when no goal attribute is set", () => {
    const html = renderState({ kind: "idle", reason: "no-goal" }, "table");
    expect(html).toContain("nlq-pending");
    expect(html).toContain("<code>goal</code>");
  });

  it("prompts for the missing db when goal is set but db isn't", () => {
    const html = renderState({ kind: "idle", reason: "no-db" }, "table");
    expect(html).toContain("nlq-pending");
    expect(html).toContain("<code>db</code>");
  });
});

describe("renderState — loading", () => {
  it("renders a pending placeholder", () => {
    expect(renderState({ kind: "loading" }, "table")).toContain("nlq-pending");
  });
});

describe("renderState — success", () => {
  it("renders rows through the chosen template", () => {
    const html = renderState({ kind: "success", data: success }, "table");
    expect(html).toContain("<table");
    expect(html).toContain("<th>customer</th>");
    expect(html).toContain("<td>Maya</td>");
    expect(html).toContain("<td>flat white</td>");
  });

  it("dispatches by template name", () => {
    expect(renderState({ kind: "success", data: success }, "list")).toContain("<ul");
    expect(renderState({ kind: "success", data: success }, "kv")).toContain("<dl");
  });

  it("renders an empty placeholder when the API returns zero rows", () => {
    const empty: AskSuccess = { ...success, rows: [], rowCount: 0 };
    const html = renderState({ kind: "success", data: empty }, "table");
    expect(html).toContain("nlq-empty");
    expect(html).not.toContain("<td>");
  });
});

describe("renderState — error", () => {
  it("renders network errors with kind=network and the message", () => {
    const html = renderState(
      { kind: "error", failure: { kind: "network", message: "Failed to fetch" } },
      "table",
    );
    expect(html).toContain('class="nlq-error"');
    expect(html).toContain('data-kind="network"');
    expect(html).toContain("Network error: Failed to fetch");
  });

  it("renders 401 auth errors with a generic 'authentication required' message", () => {
    const html = renderState({ kind: "error", failure: { kind: "auth", status: 401 } }, "table");
    expect(html).toContain('data-kind="auth"');
    expect(html).toContain("Authentication required.");
    expect(html).not.toContain("401");
  });

  it("renders the feature_gated CTA inline (SK-ELEM-014)", () => {
    const html = renderState(
      {
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
      },
      "table",
    );
    expect(html).toContain('data-kind="gated"');
    expect(html).toContain('role="status"');
    expect(html).toContain("join the waitlist for early access");
    expect(html).toContain('href="https://nlqdb.com/#waitlist"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Join the waitlist");
    expect(html).toContain("BIRD: 31.8% / 65% target");
    expect(html).toContain("Spider: not yet reporting (75% target)");
  });

  it("strips hostile waitlist_url protocols (javascript:, data:, relative)", () => {
    const make = (url: unknown) =>
      renderState(
        {
          kind: "error",
          failure: {
            kind: "api",
            status: 403,
            error: {
              status: "feature_gated",
              action: "Join the waitlist",
              waitlist_url: url,
              gate: {
                bird_accuracy: null,
                spider_accuracy: null,
                bird_target: 0.65,
                spider_target: 0.75,
              },
            },
          },
        },
        "table",
      );
    for (const url of ["javascript:alert(1)", "data:text/html,<script>", "/relative", 42, null]) {
      const html = make(url);
      expect(html).not.toContain("nlq-gated");
      expect(html).toContain("Error 403: feature_gated");
    }
  });

  it("falls back when the gated body has empty action / message strings", () => {
    const html = renderState(
      {
        kind: "error",
        failure: {
          kind: "api",
          status: 403,
          error: {
            status: "feature_gated",
            message: "   ",
            action: "",
            waitlist_url: "https://nlqdb.com/#waitlist",
          },
        },
      },
      "table",
    );
    expect(html).toContain("Join the waitlist");
    expect(html).toContain("nlqdb is pre-alpha — join the waitlist for early access.");
  });

  it("escapes hostile action/message text in the gated card", () => {
    const html = renderState(
      {
        kind: "error",
        failure: {
          kind: "api",
          status: 403,
          error: {
            status: "feature_gated",
            message: '<img src=x onerror="x">',
            action: "<script>x</script>",
            waitlist_url: "https://nlqdb.com/#waitlist",
            gate: {
              bird_accuracy: 0.5,
              bird_target: 0.65,
              spider_accuracy: null,
              spider_target: 0.75,
            },
          },
        },
      },
      "table",
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script");
  });

  it("renders structured 4xx api errors with status + slug", () => {
    const html = renderState(
      {
        kind: "error",
        failure: {
          kind: "api",
          status: 429,
          error: { status: "rate_limited", limit: 10, count: 11 },
        },
      },
      "table",
    );
    expect(html).toContain('data-kind="api"');
    // Per GLOBAL-012 the 429 path now renders a one-sentence + next-action
    // message that includes the limit/count, instead of the old "Error 429".
    expect(html).toContain("Rate limit reached (11 of 10 requests used)");
    expect(html).toContain("Please wait a moment, then try again");
  });

  it("renders structured 5xx api errors (db_unreachable) with status + slug", () => {
    const html = renderState(
      {
        kind: "error",
        failure: {
          kind: "api",
          status: 502,
          error: { status: "db_unreachable", message: "connect ECONNREFUSED" },
        },
      },
      "table",
    );
    expect(html).toContain('data-kind="api"');
    expect(html).toContain("Error 502: db_unreachable");
  });

  it("renders bare-string api errors with status + slug", () => {
    const html = renderState(
      { kind: "error", failure: { kind: "api", status: 400, error: "goal_required" } },
      "table",
    );
    expect(html).toContain("Error 400: goal_required");
  });

  it("escapes hostile error messages structurally", () => {
    const html = errorHtml({ kind: "network", message: '<img src=x onerror="x">' });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
