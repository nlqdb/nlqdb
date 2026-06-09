import { describe, expect, it } from "vitest";

import type { DnsResolver } from "../src/index.ts";
import { validateByoConnection } from "../src/index.ts";

// SK-DB-013 — the BYO connect-time validation pipeline. It composes the three
// landed connect-path primitives (URL parse → egress resolve-recheck) into the
// single entry point both engines' connect branches call. Three guarantees
// under test: (1) the parse step runs before any network I/O, so a bad shape
// fails loud (GLOBAL-012) without ever touching the resolver; (2) a host that
// resolves into a private/reserved range is rejected fail-closed (GLOBAL-035);
// (3) on success the caller gets the engine-tagged, password-stripped parsed
// connection — never the secret.

// A resolver that must not run: asserts the parse-first ordering for the cases
// where validation should short-circuit before any DNS I/O.
const never: DnsResolver = () => Promise.reject(new Error("resolver should not run"));

describe("validateByoConnection — Postgres", () => {
  it("accepts a public host and returns the redacted, engine-tagged parse", async () => {
    const result = await validateByoConnection(
      "postgres",
      "postgres://alice:supersecret@db.example.com:5432/shop?sslmode=require",
      () => Promise.resolve(["93.184.216.34"]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.connection.engine).toBe("postgres");
    expect(result.connection.parsed.redacted).toBe("postgres://alice@db.example.com:5432/shop");
    expect(result.connection.parsed.redacted).not.toContain("supersecret");
  });

  it("fails on a bad URL shape before calling the resolver", async () => {
    const result = await validateByoConnection("postgres", "mysql://h/db", never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("unsupported");
  });

  it("rejects a literal private host without resolving (SSRF)", async () => {
    const result = await validateByoConnection("postgres", "postgres://u@127.0.0.1/db", never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("private or reserved");
  });

  it("rejects a name that resolves to a private address (DNS-rebinding)", async () => {
    const result = await validateByoConnection(
      "postgres",
      "postgres://u@rebind.example.com/db",
      () => Promise.resolve(["93.184.216.34", "169.254.169.254"]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("private or reserved");
  });
});

describe("validateByoConnection — ClickHouse", () => {
  it("accepts a public HTTPS endpoint and strips the password + query", async () => {
    const result = await validateByoConnection(
      "clickhouse",
      "https://bob:hunter2@ch.example.com:8443/?database=analytics&max_rows=10",
      () => Promise.resolve(["93.184.216.34"]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.connection.engine !== "clickhouse") return;
    expect(result.connection.parsed.redacted).toBe(
      "https://bob@ch.example.com:8443/?database=analytics",
    );
    expect(result.connection.parsed.secure).toBe(true);
    expect(result.connection.parsed.redacted).not.toContain("hunter2");
  });

  it("fails on a ClickHouse client DSN scheme before resolving", async () => {
    const result = await validateByoConnection("clickhouse", "clickhouse://h:9000/db", never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("client DSN scheme");
  });

  it("rejects a literal metadata host without resolving (SSRF)", async () => {
    const result = await validateByoConnection(
      "clickhouse",
      "http://169.254.169.254/?database=default",
      never,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("private or reserved");
  });

  it("fails closed when the resolver throws", async () => {
    const result = await validateByoConnection(
      "clickhouse",
      "https://ch.example.com/?database=default",
      () => Promise.reject(new Error("DoH down")),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("could not be resolved");
  });
});
