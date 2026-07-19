import { afterEach, describe, expect, test } from "bun:test";

import {
  PMF_SNOOZE_KEY,
  fetchPmfSurveyStatus,
  pmfSnoozed,
  snoozePmfSurvey,
  submitPmfSurveyResponse,
} from "./pmf-survey.ts";

const originalFetch = globalThis.fetch;
let captured: { url: string; init?: RequestInit } | null = null;

function mockFetch(response: Response | (() => never)) {
  captured = null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = { url: String(input), init };
    if (typeof response === "function") response();
    return response as Response;
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchPmfSurveyStatus", () => {
  test("returns the status payload and sends credentials", async () => {
    mockFetch(new Response(JSON.stringify({ answered: false, eligible: true }), { status: 200 }));
    const status = await fetchPmfSurveyStatus("https://api.example.com/");
    expect(status).toEqual({ answered: false, eligible: true });
    expect(captured?.url).toBe("https://api.example.com/v1/pmf-survey");
    expect(captured?.init?.credentials).toBe("include");
  });

  test("returns null on a non-2xx (anon visitors get 401 — card stays hidden)", async () => {
    mockFetch(new Response("{}", { status: 401 }));
    expect(await fetchPmfSurveyStatus("https://api.example.com")).toBeNull();
  });

  test("returns null when fetch throws", async () => {
    mockFetch(() => {
      throw new Error("network down");
    });
    expect(await fetchPmfSurveyStatus("https://api.example.com")).toBeNull();
  });
});

describe("submitPmfSurveyResponse", () => {
  test("POSTs the response key and reports ok", async () => {
    mockFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const ok = await submitPmfSurveyResponse("https://api.example.com", "very_disappointed");
    expect(ok).toBe(true);
    expect(captured?.init?.method).toBe("POST");
    expect(String(captured?.init?.body)).toContain("very_disappointed");
  });

  test("reports false on failure without throwing", async () => {
    mockFetch(() => {
      throw new Error("network down");
    });
    expect(await submitPmfSurveyResponse("https://api.example.com", "na")).toBe(false);
  });
});

describe("snooze helpers", () => {
  function memStorage() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  }

  test("snooze hides for 7 days, then re-asks", () => {
    const storage = memStorage();
    const now = 1_800_000_000_000;
    expect(pmfSnoozed(storage, now)).toBe(false);
    snoozePmfSurvey(storage, now);
    expect(pmfSnoozed(storage, now + 1)).toBe(true);
    expect(pmfSnoozed(storage, now + 7 * 24 * 60 * 60 * 1000 + 1)).toBe(false);
  });

  test("a garbage stored value never blocks the card", () => {
    const storage = memStorage();
    storage.setItem(PMF_SNOOZE_KEY, "not-a-number");
    expect(pmfSnoozed(storage, Date.now())).toBe(false);
  });
});
