import type { EventEnvelope } from "@nlqdb/events";
import { describe, expect, it, vi } from "vitest";
import { publishToPostHog, toBatchItem } from "../src/sinks/posthog.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function envelope(id: string, event: EventEnvelope["event"]): EventEnvelope {
  return { id, ts: 1_700_000_000_000, event };
}

describe("toBatchItem", () => {
  it("maps a user event: name → event, userId → distinct_id, fields → properties", async () => {
    const item = await toBatchItem(
      envelope("user.first_query.u_1", { name: "user.first_query", userId: "u_1", dbId: "db_1" }),
    );
    expect(item.event).toBe("user.first_query");
    expect(item.distinct_id).toBe("u_1");
    expect(item.timestamp).toBe(new Date(1_700_000_000_000).toISOString());
    // Generic mapping: every typed field carries through as a property
    // (the identity field too — harmless and queryable), plus `nlqdb_event`.
    expect(item.properties).toMatchObject({
      dbId: "db_1",
      userId: "u_1",
      nlqdb_event: "user.first_query",
    });
    expect(item.uuid).toMatch(UUID_RE);
  });

  it("uses principalId as distinct_id for demand-signal events", async () => {
    const item = await toBatchItem(
      envelope("feature.requested.heavier_tier.anon:x.2026-07-16", {
        name: "feature.requested.heavier_tier",
        principalId: "anon:x",
        surface: "hero",
      }),
    );
    expect(item.distinct_id).toBe("anon:x");
    expect(item.properties).toMatchObject({ surface: "hero" });
  });

  it("uses dbId as distinct_id for the anonymised ask.completed event", async () => {
    const item = await toBatchItem(
      envelope("evt.abc", {
        name: "ask.completed",
        dbId: "db_9",
        schemaHash: "s1",
        queryHash: "q1",
        planShape: "p1",
        engine: "postgres",
        orchestratorMs: 42,
        rowsReturned: 3,
        ts: 1_700_000_000_500,
      }),
    );
    expect(item.distinct_id).toBe("db_9");
    expect(item.event).toBe("ask.completed");
  });

  it("derives a deterministic, well-formed UUID from the envelope id (dedup)", async () => {
    const a = await toBatchItem(
      envelope("user.registered.u_7", { name: "user.registered", userId: "u_7", email: "a@b.co" }),
    );
    const b = await toBatchItem(
      envelope("user.registered.u_7", { name: "user.registered", userId: "u_7", email: "a@b.co" }),
    );
    // Same envelope id → same uuid across redeliveries.
    expect(a.uuid).toBe(b.uuid);
    expect(a.uuid).toMatch(UUID_RE);
    // Distinct envelope id → distinct uuid.
    const c = await toBatchItem(
      envelope("user.registered.u_8", { name: "user.registered", userId: "u_8", email: "c@d.co" }),
    );
    expect(c.uuid).not.toBe(a.uuid);
  });
});

describe("publishToPostHog", () => {
  const env: EventEnvelope = envelope("user.first_query.u_1", {
    name: "user.first_query",
    userId: "u_1",
    dbId: "db_1",
  });

  it("POSTs one /batch call carrying api_key + a batch array", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    await publishToPostHog(
      { apiKey: "phc_test", host: "https://eu.i.posthog.com" },
      [env],
      fetchMock as unknown as typeof fetch,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const first = calls[0];
    if (!first) throw new Error("expected a posthog fetch call");
    const [url, init] = first;
    expect(url).toBe("https://eu.i.posthog.com/batch/");
    const body = JSON.parse(init.body as string) as { api_key: string; batch: unknown[] };
    expect(body.api_key).toBe("phc_test");
    expect(body.batch).toHaveLength(1);
    expect(body.batch[0]).toMatchObject({ event: "user.first_query", distinct_id: "u_1" });
  });

  it("is a no-op with no fetch when the batch is empty", async () => {
    const fetchMock = vi.fn();
    await publishToPostHog(
      { apiKey: "phc_test", host: "https://eu.i.posthog.com" },
      [],
      fetchMock as unknown as typeof fetch,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows a non-2xx response (best-effort — never throws)", async () => {
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    await expect(
      publishToPostHog(
        { apiKey: "phc_test", host: "https://eu.i.posthog.com" },
        [env],
        fetchMock as unknown as typeof fetch,
      ),
    ).resolves.toBeUndefined();
  });

  it("swallows a transport throw (best-effort — never throws)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(
      publishToPostHog(
        { apiKey: "phc_test", host: "https://eu.i.posthog.com" },
        [env],
        fetchMock as unknown as typeof fetch,
      ),
    ).resolves.toBeUndefined();
  });
});
