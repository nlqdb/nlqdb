// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../src/index.ts";
import type { NlqActionElement } from "../src/action-element.ts";
import type { AskDiff } from "../src/fetch.ts";

const previewBody = {
  status: "ok" as const,
  cached: false,
  sql: "INSERT INTO orders ...",
  rows: [],
  rowCount: 0,
  requires_confirm: true,
  diff: {
    verb: "INSERT" as const,
    table: "orders",
    affectedRows: 1,
    summary: "Insert 1 row into orders",
  },
};

const commitBody = {
  status: "ok" as const,
  cached: false,
  sql: "INSERT INTO orders ...",
  rows: [{ id: 1 }],
  rowCount: 1,
};

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function makeFetchMock(...bodies: unknown[]): ReturnType<typeof vi.fn> {
  const queue = [...bodies];
  return vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error("fetch called more times than expected");
    return jsonResponse(next);
  });
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function settle(): Promise<void> {
  // Drain microtasks + the timer queue. Element transitions use
  // `await` chains plus event dispatches; one `tick` lands the next
  // render swap.
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

function makeAction(opts: {
  goal: string;
  db: string;
  label?: string;
  onSuccess?: string;
  endpoint?: string;
  fetchMock: ReturnType<typeof vi.fn>;
  form?: HTMLFormElement;
}): NlqActionElement {
  const el = document.createElement("nlq-action") as NlqActionElement;
  el.setAttribute("goal", opts.goal);
  el.setAttribute("db", opts.db);
  el.setAttribute("endpoint", opts.endpoint ?? "https://api.example/v1/ask");
  if (opts.onSuccess) el.setAttribute("on-success", opts.onSuccess);
  el.textContent = opts.label ?? "Submit";
  vi.stubGlobal("fetch", opts.fetchMock);
  if (opts.form) {
    opts.form.appendChild(el);
    mountPoint.appendChild(opts.form);
  } else {
    mountPoint.appendChild(el);
  }
  return el;
}

function clickButton(el: HTMLElement, selector = "button"): void {
  const button = el.querySelector(selector);
  if (!button) throw new Error(`button "${selector}" not found in ${el.innerHTML}`);
  (button as HTMLButtonElement).click();
}

describe("<nlq-action> happy path", () => {
  it("renders the label as a button on mount", async () => {
    const fetchMock = makeFetchMock();
    const el = makeAction({ goal: "add an order", db: "orders", fetchMock });
    await settle();
    expect(el.innerHTML).toContain('data-action-state="idle"');
    expect(el.innerHTML).toContain(">Submit<");
  });

  it("preview → confirm → apply: two fetches, second carries confirm:true", async () => {
    const fetchMock = makeFetchMock(previewBody, commitBody);
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.name = "customer";
    input.value = "alice";
    form.appendChild(input);
    const el = makeAction({ goal: "add an order", db: "orders", fetchMock, form });

    const successEvents: CustomEvent[] = [];
    const confirmEvents: CustomEvent[] = [];
    el.addEventListener("nlq-action:success", (e) => successEvents.push(e as CustomEvent));
    el.addEventListener("nlq-action:confirm-required", (e) => confirmEvents.push(e as CustomEvent));

    clickButton(el);
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstBody = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string);
    expect(firstBody).toEqual({
      goal: "add an order\n\nForm data:\n- customer: alice",
      dbId: "orders",
    });
    expect(el.innerHTML).toContain("Insert 1 row into orders");
    expect(el.querySelector('[data-action="apply"]')).not.toBeNull();
    expect(confirmEvents.length).toBe(1);

    clickButton(el, '[data-action="apply"]');
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1].body as string);
    expect(secondBody).toEqual({
      goal: "add an order\n\nForm data:\n- customer: alice",
      dbId: "orders",
      confirm: true,
    });
    expect(el.innerHTML).toContain("Done");
    expect(successEvents.length).toBe(1);
    const detail = successEvents[0]?.detail as { rowCount: number; diff: AskDiff };
    expect(detail.rowCount).toBe(1);
    expect(detail.diff.verb).toBe("INSERT");
  });

  it("Cancel after preview returns to idle without firing a commit", async () => {
    const fetchMock = makeFetchMock(previewBody);
    const el = makeAction({ goal: "add an order", db: "orders", fetchMock });

    clickButton(el);
    await settle();
    expect(el.querySelector('[data-action="cancel"]')).not.toBeNull();

    clickButton(el, '[data-action="cancel"]');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(el.innerHTML).toContain('data-action-state="idle"');
  });

  it("commits without an associated form when no form ancestor exists", async () => {
    const fetchMock = makeFetchMock(previewBody, commitBody);
    const el = makeAction({ goal: "add a default order", db: "orders", fetchMock });

    clickButton(el);
    await settle();
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body as string)).toEqual({
      goal: "add a default order",
      dbId: "orders",
    });
  });
});

describe("<nlq-action> auth + validation", () => {
  it("renders a goal_required error when goal is missing", async () => {
    const fetchMock = makeFetchMock();
    const el = makeAction({ goal: "", db: "orders", fetchMock });
    clickButton(el);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(el.innerHTML).toContain("goal_required");
  });

  it("renders a db_required error when db is missing", async () => {
    const fetchMock = makeFetchMock();
    const el = makeAction({ goal: "x", db: "", fetchMock });
    clickButton(el);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(el.innerHTML).toContain("db_required");
  });

  it("attaches the api-key as a Bearer header forward-compat", async () => {
    const fetchMock = makeFetchMock(previewBody, commitBody);
    const el = makeAction({ goal: "x", db: "orders", fetchMock });
    el.setAttribute("api-key", "pk_live_xxx");

    clickButton(el);
    await settle();
    const headers = fetchMock.mock.calls[0]?.[1].headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer pk_live_xxx");
  });

  it("surfaces auth failures via nlq-action:error and renders a retry button", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "unauthorized" }, { status: 401 }));
    const el = makeAction({ goal: "x", db: "orders", fetchMock });

    const errors: CustomEvent[] = [];
    el.addEventListener("nlq-action:error", (e) => errors.push(e as CustomEvent));

    clickButton(el);
    await settle();
    expect(errors.length).toBe(1);
    expect(errors[0]?.detail).toEqual({ kind: "auth", status: 401 });
    expect(el.innerHTML).toContain("Sign in required");
    expect(el.querySelector('[data-action="retry"]')).not.toBeNull();
  });

  it("surfaces api failures via nlq-action:error", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { error: { status: "sql_rejected", reason: "DROP not allowed" } },
        { status: 400 },
      ),
    );
    const el = makeAction({ goal: "drop table users", db: "orders", fetchMock });

    clickButton(el);
    await settle();
    expect(el.innerHTML).toContain("sql_rejected");
  });
});

describe("<nlq-action> on-success behaviours", () => {
  it('on-success="reset" calls reset() on the associated form', async () => {
    const fetchMock = makeFetchMock(previewBody, commitBody);
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.name = "customer";
    input.value = "alice";
    input.defaultValue = "";
    form.appendChild(input);
    const el = makeAction({
      goal: "add an order",
      db: "orders",
      fetchMock,
      onSuccess: "reset",
      form,
    });

    clickButton(el);
    await settle();
    clickButton(el, '[data-action="apply"]');
    await settle();
    expect(input.value).toBe("");
  });

  it('on-success="refresh:<selector>" calls .refresh() on matching elements', async () => {
    const fetchMock = makeFetchMock(previewBody, commitBody);
    const sibling = document.createElement("div");
    sibling.id = "data-pane";
    const refresh = vi.fn();
    (sibling as unknown as { refresh: () => void }).refresh = refresh;
    mountPoint.appendChild(sibling);

    const el = makeAction({
      goal: "add an order",
      db: "orders",
      fetchMock,
      onSuccess: "refresh:#data-pane",
    });
    clickButton(el);
    await settle();
    clickButton(el, '[data-action="apply"]');
    await settle();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("<nlq-action> observability", () => {
  it("mirrors the state machine on the host's data-state attribute", async () => {
    const fetchMock = makeFetchMock(previewBody, commitBody);
    const el = makeAction({ goal: "x", db: "orders", fetchMock });
    expect(el.dataset["state"]).toBe("idle");

    clickButton(el);
    await settle();
    expect(el.dataset["state"]).toBe("confirm");

    clickButton(el, '[data-action="apply"]');
    await settle();
    expect(el.dataset["state"]).toBe("success");
  });

  it("data-state moves to error on auth failure and back to idle on retry", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, { status: 401 }));
    const el = makeAction({ goal: "x", db: "orders", fetchMock });
    clickButton(el);
    await settle();
    expect(el.dataset["state"]).toBe("error");

    clickButton(el, '[data-action="retry"]');
    await settle();
    expect(el.dataset["state"]).toBe("idle");
  });
});

describe("<nlq-action> robustness", () => {
  it("transitions to error (not stuck in previewing) when fetch throws an unexpected error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const el = makeAction({ goal: "x", db: "orders", fetchMock });
    const errors: CustomEvent[] = [];
    el.addEventListener("nlq-action:error", (e) => errors.push(e as CustomEvent));

    clickButton(el);
    await settle();

    expect(el.dataset["state"]).toBe("error");
    expect(errors.length).toBe(1);
    expect(errors[0]?.detail).toEqual({ kind: "network", message: "Failed to fetch" });
  });

  it("does not let an outer parent's data-action hijack a click inside the element", async () => {
    const fetchMock = makeFetchMock(previewBody, commitBody);
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-action", "apply");
    mountPoint.appendChild(wrapper);
    const el = document.createElement("nlq-action") as NlqActionElement;
    el.setAttribute("goal", "x");
    el.setAttribute("db", "orders");
    el.setAttribute("endpoint", "https://api.example/v1/ask");
    el.textContent = "Submit";
    vi.stubGlobal("fetch", fetchMock);
    wrapper.appendChild(el);
    await settle();

    clickButton(el);
    await settle();
    // First click went through `preview()`, not `applyDiff()` — fetch
    // was called exactly once with the preview body (no `confirm`).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body as string)).toEqual({
      goal: "x",
      dbId: "orders",
    });
  });

  it("continues refreshing remaining matches when one .refresh() throws", async () => {
    const fetchMock = makeFetchMock(previewBody, commitBody);
    const ok = document.createElement("div");
    ok.className = "data-pane";
    const okRefresh = vi.fn();
    (ok as unknown as { refresh: () => void }).refresh = okRefresh;

    const bad = document.createElement("div");
    bad.className = "data-pane";
    (bad as unknown as { refresh: () => void }).refresh = () => {
      throw new Error("boom");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    mountPoint.appendChild(bad);
    mountPoint.appendChild(ok);

    const el = makeAction({
      goal: "x",
      db: "orders",
      fetchMock,
      onSuccess: "refresh:.data-pane",
    });
    clickButton(el);
    await settle();
    clickButton(el, '[data-action="apply"]');
    await settle();

    expect(okRefresh).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });
});

describe("<nlq-action> on-success robustness", () => {
  it("does not throw when on-success uses an invalid selector", async () => {
    const fetchMock = makeFetchMock(previewBody, commitBody);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const el = makeAction({
      goal: "x",
      db: "orders",
      fetchMock,
      onSuccess: "refresh:[bad",
    });
    clickButton(el);
    await settle();
    clickButton(el, '[data-action="apply"]');
    await settle();
    expect(warn).toHaveBeenCalled();
    expect(el.innerHTML).toContain("Done");
  });

  it("warns on unrecognised on-success directives", async () => {
    const fetchMock = makeFetchMock(previewBody, commitBody);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const el = makeAction({
      goal: "x",
      db: "orders",
      fetchMock,
      onSuccess: "celebrate",
    });
    clickButton(el);
    await settle();
    clickButton(el, '[data-action="apply"]');
    await settle();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('on-success="celebrate"'));
  });

  it("aborts an in-flight preview when the element is disconnected", async () => {
    let resolved = false;
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
          setTimeout(() => {
            resolved = true;
            resolve(jsonResponse(previewBody));
          }, 100);
        }),
    );
    const el = makeAction({ goal: "x", db: "orders", fetchMock });
    clickButton(el);
    await tick();
    el.remove();
    await settle();
    expect(resolved).toBe(false);
  });

  it("returning to idle after an error and re-clicking fires a fresh preview", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, { status: 500 }));
    const el = makeAction({ goal: "x", db: "orders", fetchMock });
    clickButton(el);
    await settle();
    expect(el.innerHTML).toContain('data-action-state="error"');

    // Now swap the mock to a success-shaped pair and click retry → re-click.
    let calls = 0;
    const successMock = vi.fn(async () => {
      calls += 1;
      return jsonResponse(calls === 1 ? previewBody : commitBody);
    });
    vi.stubGlobal("fetch", successMock);
    clickButton(el, '[data-action="retry"]');
    await settle();
    expect(el.innerHTML).toContain('data-action-state="idle"');
    clickButton(el);
    await settle();
    expect(el.innerHTML).toContain("Insert 1 row");
  });
});

describe("<nlq-action> registration", () => {
  it("is registered on customElements as 'nlq-action'", () => {
    expect(customElements.get("nlq-action")).toBeDefined();
  });

  it("re-importing the module is a no-op (idempotent registration)", async () => {
    const first = customElements.get("nlq-action");
    await import("../src/index.ts");
    expect(customElements.get("nlq-action")).toBe(first);
  });
});
