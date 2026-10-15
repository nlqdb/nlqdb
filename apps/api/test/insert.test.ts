// `/v1/insert` integration — principal gate only; the 200 path lives in `src/insert/orchestrate.test.ts`.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import "./apply-migrations.ts";

const body = JSON.stringify({ db: "db_x", table: "votes", rows: [{ vote: "up" }] });

describe("POST /v1/insert — principal gate", () => {
  it("returns 401 when no auth is present", async () => {
    const res = await SELF.fetch("https://example.com/v1/insert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(res.status).toBe(401);
  });

  it("refuses an anonymous (read-only) principal with 403 forbidden", async () => {
    const res = await SELF.fetch("https://example.com/v1/insert", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_abcdef0123456789",
      },
      body,
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "forbidden" } });
  });
});
