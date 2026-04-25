import { describe, expect, it } from "vitest";
import worker from "../src/index";

const env = {} as Record<string, never>;

describe("/v1/health", () => {
  it("returns 200 with status:ok and an ISO timestamp", async () => {
    const res = await worker.fetch(new Request("https://example.com/v1/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; version: string; timestamp: string };
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns 404 for unknown paths", async () => {
    const res = await worker.fetch(new Request("https://example.com/nope"), env);
    expect(res.status).toBe(404);
  });
});
