import { describe, expect, it } from "vitest";
import worker from "../src/index";

// Slice 2: bindings are typed but tests still pass mock objects. Slice
// 3+ swaps to @cloudflare/vitest-pool-workers / Miniflare for real
// binding behaviour once we exercise KV / D1 from handler code.
type Env = {
  KV: KVNamespace;
  DB: D1Database;
};

const env: Env = {
  KV: {} as KVNamespace,
  DB: {} as D1Database,
};

describe("/v1/health", () => {
  it("returns 200 with status:ok, version, ISO timestamp, and binding presence", async () => {
    const res = await worker.fetch(new Request("https://example.com/v1/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      version: string;
      timestamp: string;
      bindings: { kv: boolean; db: boolean };
    };
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.bindings).toEqual({ kv: true, db: true });
  });

  it("reports bindings: false when env is empty", async () => {
    const res = await worker.fetch(new Request("https://example.com/v1/health"), {} as Env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bindings: { kv: boolean; db: boolean } };
    expect(body.bindings).toEqual({ kv: false, db: false });
  });

  it("returns 404 for unknown paths", async () => {
    const res = await worker.fetch(new Request("https://example.com/nope"), env);
    expect(res.status).toBe(404);
  });
});
