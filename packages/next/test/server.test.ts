import { afterEach, beforeEach, describe, expect, it } from "vitest";

// `server-only` + `next/script` are aliased to stubs in vitest.config.ts.
import { createAskRoute, nlqdbServer } from "../src/server.ts";

describe("nlqdbServer()", () => {
  let originalKey: string | undefined;
  beforeEach(() => {
    originalKey = process.env["NLQDB_API_KEY"];
    delete process.env["NLQDB_API_KEY"];
  });
  afterEach(() => {
    if (originalKey !== undefined) process.env["NLQDB_API_KEY"] = originalKey;
    else delete process.env["NLQDB_API_KEY"];
  });

  it("throws a friendly error when NLQDB_API_KEY is unset and no apiKey is passed", () => {
    expect(() => nlqdbServer()).toThrow(/NLQDB_API_KEY/);
  });

  it("returns a client when NLQDB_API_KEY is set", () => {
    process.env["NLQDB_API_KEY"] = "sk_live_test";
    const client = nlqdbServer();
    expect(typeof client.ask).toBe("function");
  });

  it("prefers an explicit apiKey over the env var", () => {
    process.env["NLQDB_API_KEY"] = "sk_live_env";
    const client = nlqdbServer({ apiKey: "sk_live_arg" });
    expect(typeof client.ask).toBe("function");
  });
});

describe("createAskRoute()", () => {
  it("returns a 400 with invalid_json envelope on a non-JSON body", async () => {
    process.env["NLQDB_API_KEY"] = "sk_live_test";
    const handler = createAskRoute();
    const res = await handler(
      new Request("http://localhost/api/nlqdb/ask", {
        method: "POST",
        body: "not json",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { status: string } };
    expect(json.error.status).toBe("invalid_json");
    delete process.env["NLQDB_API_KEY"];
  });
});
