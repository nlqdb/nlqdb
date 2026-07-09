// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../src/index.ts";
import type { NlqDataLoadDetail } from "../src/element.ts";
import type { AskTrace } from "../src/fetch.ts";

// SK-TRUST-002 — `<nlq-data>` exposes the response trace via the
// `el.trace` JS property AND on the `nlq-data:load` event detail, so an
// embedder can gate its own UI (e.g. a low-confidence free-model nudge
// per SK-PREMIUM-004) without re-parsing the response. This is the
// elements slice of the cross-surface trace parity (GLOBAL-003).

const trace: AskTrace = {
  sql: "SELECT count(*) FROM orders",
  plan_id: "sh:qh",
  confidence: 0.42,
  model: "free-chain",
  cache_hit: true,
};

const okBody = { status: "ok" as const, rows: [{ n: 3 }], rowCount: 1, trace };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function settle(): Promise<void> {
  await tick();
  await tick();
}

let mountPoint: HTMLDivElement;

beforeEach(() => {
  mountPoint = document.createElement("div");
  document.body.appendChild(mountPoint);
});

afterEach(() => {
  mountPoint.remove();
  vi.restoreAllMocks();
});

function makeData(fetchMock: ReturnType<typeof vi.fn>): HTMLElement {
  const el = document.createElement("nlq-data");
  el.setAttribute("goal", "how many orders");
  el.setAttribute("db", "orders");
  el.setAttribute("endpoint", "https://api.example/v1/ask");
  vi.stubGlobal("fetch", fetchMock);
  mountPoint.appendChild(el);
  return el;
}

describe("<nlq-data> trace (SK-TRUST-002)", () => {
  it("exposes the response trace via el.trace after a successful load", async () => {
    const el = makeData(vi.fn(async () => jsonResponse(okBody)));
    await settle();
    expect((el as unknown as { trace: AskTrace | null }).trace).toEqual(trace);
  });

  it("forwards trace + cache state on the nlq-data:load event", async () => {
    let detail: NlqDataLoadDetail | null = null;
    const el = makeData(vi.fn(async () => jsonResponse(okBody)));
    el.addEventListener("nlq-data:load", (e) => {
      detail = (e as CustomEvent<NlqDataLoadDetail>).detail;
    });
    await settle();
    expect(detail).not.toBeNull();
    const d = detail as unknown as NlqDataLoadDetail;
    expect(d.rows).toBe(1);
    expect(d.cached).toBe(true); // sourced from trace.cache_hit, not a phantom top-level field
    expect(d.trace).toEqual(trace);
  });

  it("clears el.trace on an error response", async () => {
    const el = makeData(vi.fn(async () => jsonResponse({ status: "db_not_found" }, 404)));
    await settle();
    expect((el as unknown as { trace: AskTrace | null }).trace).toBeNull();
  });
});
