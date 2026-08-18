import { describe, expect, it } from "vitest";
import type { AskSuccess } from "../src/fetch.ts";
import { errorHtml, renderState } from "../src/render.ts";

const success: AskSuccess = {
  status: "ok",
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

  it("renders structured 4xx api errors with status + slug", () => {
    const html = renderState(
      {
        kind: "error",
        failure: {
          kind: "api",
          status: 429,
          error: {
            code: "rate_limited",
            message: "You've used 11 of 10 requests in this window.",
            action: "Wait a moment, then retry.",
            retryable: true,
            params: { limit: 10, count: 11 },
          },
        },
      },
      "table",
    );
    expect(html).toContain('data-kind="api"');
    // SK-ERR-001 — the server renders the sentence + action (GLOBAL-012); this
    // element prints both verbatim rather than keeping its own rate-limit copy.
    expect(html).toContain("You&#39;ve used 11 of 10 requests in this window.");
    expect(html).toContain("Wait a moment, then retry.");
  });

  it("renders the server's sentence + action for a structured 5xx (db_unreachable)", () => {
    const html = renderState(
      {
        kind: "error",
        failure: {
          kind: "api",
          status: 502,
          error: {
            code: "db_unreachable",
            message: "nlqdb couldn't reach that database just now.",
            action: "Try again in a moment; if it persists, check the database is running.",
          },
        },
      },
      "table",
    );
    expect(html).toContain('data-kind="api"');
    // SK-ERR-001 — `data-kind` still lets the page branch without parsing text,
    // but the text itself is the server's copy, not "Error 502: db_unreachable".
    expect(html).toContain("couldn&#39;t reach that database");
    expect(html).toContain("Try again in a moment");
    expect(html).not.toContain("Error 502");
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
