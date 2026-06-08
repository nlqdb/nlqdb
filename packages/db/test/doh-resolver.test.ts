import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDohResolver, guardEgressHostResolved } from "../src/index.ts";

// GLOBAL-035 production DnsResolver: the DoH lookup `guardEgressHostResolved`
// uses to resolve a needsDnsRecheck host. Guarantees under test: (1) returns
// every A + AAAA address as a bare IP, dropping non-address answer types;
// (2) fails loud (GLOBAL-012) on any transport/parse/timeout error so the
// guard fails closed; (3) emits a single dns.resolve span (GLOBAL-014).

let telemetry: TestTelemetry;

beforeEach(() => {
  telemetry = createTestTelemetry();
});

afterEach(() => {
  telemetry.reset();
});

// Build a fetch stub keyed by the requested record type (A=1, AAAA=28), so a
// test can hand back different answers per leg.
type Json = { Status?: number; Answer?: unknown };
function stubFetch(byType: Record<number, Json | "error" | "non-ok">): typeof fetch {
  return (async (url: string) => {
    const type = Number(new URL(url).searchParams.get("type"));
    const outcome = byType[type] ?? { Answer: [] };
    if (outcome === "error") throw new Error("network down");
    if (outcome === "non-ok") return { ok: false, status: 502, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => outcome };
  }) as unknown as typeof fetch;
}

const aRec = (data: string) => ({ name: "db.example.com", type: 1, TTL: 60, data });
const aaaaRec = (data: string) => ({ name: "db.example.com", type: 28, TTL: 60, data });

describe("createDohResolver — answer extraction", () => {
  it("returns combined, deduped A + AAAA addresses", async () => {
    const resolve = createDohResolver({
      fetchImpl: stubFetch({
        1: { Status: 0, Answer: [aRec("93.184.216.34"), aRec("93.184.216.34")] },
        28: { Status: 0, Answer: [aaaaRec("2606:2800:220:1::1")] },
      }),
    });
    expect(await resolve("db.example.com")).toEqual(["93.184.216.34", "2606:2800:220:1::1"]);
  });

  it("drops non-address answer types (CNAME chain) and keeps only the flattened IPs", async () => {
    const resolve = createDohResolver({
      fetchImpl: stubFetch({
        1: {
          Status: 0,
          Answer: [
            { name: "db.example.com", type: 5, TTL: 60, data: "alias.example.net." },
            aRec("93.184.216.34"),
          ],
        },
      }),
    });
    expect(await resolve("db.example.com")).toEqual(["93.184.216.34"]);
  });

  it("returns [] for an NXDOMAIN / empty Answer (caller fails this closed)", async () => {
    const resolve = createDohResolver({
      fetchImpl: stubFetch({ 1: { Status: 3 }, 28: { Status: 3 } }),
    });
    expect(await resolve("nope.example.com")).toEqual([]);
  });
});

describe("createDohResolver — fails loud (GLOBAL-012)", () => {
  it("throws when a leg returns non-2xx", async () => {
    const resolve = createDohResolver({
      fetchImpl: stubFetch({ 1: "non-ok", 28: { Answer: [] } }),
    });
    await expect(resolve("db.example.com")).rejects.toThrow(/HTTP 502/);
  });

  it("throws when the transport errors", async () => {
    const resolve = createDohResolver({ fetchImpl: stubFetch({ 1: "error" }) });
    await expect(resolve("db.example.com")).rejects.toThrow();
  });

  it("aborts and throws when a leg exceeds the timeout", async () => {
    // Never resolves on its own; only the resolver's AbortController unblocks it.
    const slowFetch = ((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_res, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    const resolve = createDohResolver({ fetchImpl: slowFetch, timeoutMs: 5 });
    await expect(resolve("db.example.com")).rejects.toThrow();
  });
});

describe("createDohResolver — observability (GLOBAL-014)", () => {
  it("emits exactly one dns.resolve span carrying the question name and answer count", async () => {
    const resolve = createDohResolver({
      fetchImpl: stubFetch({ 1: { Answer: [aRec("8.8.8.8")] }, 28: { Answer: [] } }),
    });
    await resolve("db.example.com");
    const spans = telemetry.spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe("dns.resolve");
    expect(spans[0]?.attributes["dns.question.name"]).toBe("db.example.com");
    expect(spans[0]?.attributes["dns.answer.count"]).toBe(1);
    expect(spans[0]?.attributes["server.address"]).toBe("cloudflare-dns.com");
  });

  it("marks the span ERROR when the resolve fails", async () => {
    const resolve = createDohResolver({ fetchImpl: stubFetch({ 1: "error" }) });
    await expect(resolve("db.example.com")).rejects.toThrow();
    const span = telemetry.spanExporter.getFinishedSpans()[0];
    expect(span?.status.code).toBe(2); // SpanStatusCode.ERROR
  });
});

// The whole point: a real resolver feeding the guard blocks a DNS-rebind to a
// private address, and lets an all-public resolve through.
describe("createDohResolver ∘ guardEgressHostResolved", () => {
  it("blocks a name that resolves to the cloud-metadata IP", async () => {
    const resolve = createDohResolver({
      fetchImpl: stubFetch({ 1: { Answer: [aRec("169.254.169.254")] }, 28: { Answer: [] } }),
    });
    const result = await guardEgressHostResolved("rebind.example.com", resolve);
    expect(result.ok).toBe(false);
  });

  it("fails closed when the DoH endpoint is unreachable", async () => {
    const resolve = createDohResolver({ fetchImpl: stubFetch({ 1: "error" }) });
    const result = await guardEgressHostResolved("db.example.com", resolve);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("could not be resolved");
  });

  it("allows a name that resolves only to public addresses", async () => {
    const resolve = createDohResolver({
      fetchImpl: stubFetch({ 1: { Answer: [aRec("93.184.216.34")] }, 28: { Answer: [] } }),
    });
    const result = await guardEgressHostResolved("db.example.com", resolve);
    expect(result.ok).toBe(true);
  });
});
