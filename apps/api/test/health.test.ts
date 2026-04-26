// `/v1/health` against the real worker via Miniflare. KV + D1 bindings
// come from wrangler.toml; the response should report both as present.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("/v1/health", () => {
  it("returns 200 with status:ok, version, ISO timestamp, and binding presence", async () => {
    const res = await SELF.fetch("https://example.com/v1/health");
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

  it("returns 404 for unknown paths", async () => {
    const res = await SELF.fetch("https://example.com/nope");
    expect(res.status).toBe(404);
  });
});
