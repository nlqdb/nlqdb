import { describe, expect, it } from "vitest";
import {
  parseClickhouseUrl,
  redactClickhouseUrl,
  UNPARSEABLE_CLICKHOUSE_URL,
} from "../src/index.ts";

// SK-MULTIENG-006 — the BYO ClickHouse connection-URL primitive, the
// ClickHouse parallel of SK-DB-012. Two guarantees under test: (1) it fails
// loud at the wire boundary on anything `fetch` couldn't use (GLOBAL-012),
// and (2) the password — carried in the userinfo and/or the `?password=`
// query param per the ClickHouse HTTP docs — never survives into the
// redacted display form (the only form allowed on a span / log / UI).

describe("parseClickhouseUrl — accepts valid ClickHouse HTTP URLs", () => {
  it("parses a full https URL and strips the password + query from the redacted form", () => {
    const result = parseClickhouseUrl(
      "https://alice:supersecret@ch.example.com:8443/?database=events&max_result_rows=100",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed).toEqual({
      redacted: "https://alice@ch.example.com:8443/?database=events",
      secure: true,
      host: "ch.example.com",
      port: 8443,
      database: "events",
      user: "alice",
    });
    expect(result.parsed.redacted).not.toContain("supersecret");
    expect(result.parsed.redacted).not.toContain("max_result_rows");
  });

  it("defaults the database to `default` when no ?database= param is present", () => {
    const result = parseClickhouseUrl("http://host:8123/");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.database).toBe("default");
    expect(result.parsed.secure).toBe(false);
    expect(result.parsed.redacted).toBe("http://host:8123/?database=default");
  });

  it("accepts a ClickHouse Cloud-shaped URL with no explicit port", () => {
    const result = parseClickhouseUrl(
      "https://abc123.us-east-1.aws.clickhouse.cloud/?database=analytics",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.port).toBeNull();
    expect(result.parsed.redacted).toBe(
      "https://abc123.us-east-1.aws.clickhouse.cloud/?database=analytics",
    );
  });

  it("reads credentials from query params (?user=/?password=) and drops the password", () => {
    const result = parseClickhouseUrl(
      "https://ch.example.com:8443/?user=reader&password=supersecret&database=logs",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.user).toBe("reader");
    expect(result.parsed.redacted).toBe("https://reader@ch.example.com:8443/?database=logs");
    expect(result.parsed.redacted).not.toContain("supersecret");
    expect(result.parsed.redacted).not.toContain("password");
  });

  it("prefers the userinfo user over the ?user= param", () => {
    const result = parseClickhouseUrl("https://owner@ch.example.com/?user=other&database=db");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.user).toBe("owner");
  });

  it("accepts an absent user (no leading @ in the redacted form)", () => {
    const result = parseClickhouseUrl("https://ch.example.com:8443/?database=db");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.user).toBeNull();
    expect(result.parsed.redacted).toBe("https://ch.example.com:8443/?database=db");
  });

  it("handles an IPv6 host with a port", () => {
    const result = parseClickhouseUrl("http://u:p@[::1]:8123/?database=db");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.host).toBe("[::1]");
    expect(result.parsed.port).toBe(8123);
    expect(result.parsed.redacted).toBe("http://u@[::1]:8123/?database=db");
  });

  it("trims surrounding whitespace", () => {
    expect(parseClickhouseUrl("  https://host:8443/?database=db  ").ok).toBe(true);
  });
});

describe("parseClickhouseUrl — rejects unusable input (GLOBAL-012)", () => {
  it("rejects an empty / whitespace-only string", () => {
    for (const raw of ["", "   "]) {
      const result = parseClickhouseUrl(raw);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.message).toMatch(/empty/i);
    }
  });

  it("rejects a non-URL string", () => {
    const result = parseClickhouseUrl("definitely not a url");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/malformed/i);
  });

  it("rejects the native TCP protocol scheme and points at the HTTP interface", () => {
    const result = parseClickhouseUrl("clickhouse://u:p@host:9440/db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("clickhouse");
    expect(result.message).toMatch(/HTTP interface/i);
    expect(result.message).toMatch(/8123|8443/);
  });

  it("rejects an unrelated scheme and names it", () => {
    const result = parseClickhouseUrl("mysql://u:p@host/db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("mysql");
    expect(result.message).toMatch(/http/i);
  });

  it("rejects a missing host", () => {
    const result = parseClickhouseUrl("https:///?database=db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/host/i);
  });

  it("rejects a comma-separated multi-host URL", () => {
    const result = parseClickhouseUrl("https://u:p@h1,h2:8443/?database=db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/host/i);
  });

  it("never echoes a secret in a rejection message", () => {
    const result = parseClickhouseUrl("mysql://u:supersecret@host/db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toContain("supersecret");
  });
});

describe("redactClickhouseUrl", () => {
  it("returns the password-stripped display form for a valid URL", () => {
    expect(redactClickhouseUrl("https://u:p@host:8443/?database=db&password=x")).toBe(
      "https://u@host:8443/?database=db",
    );
  });

  it("returns the sentinel and never echoes the input on a parse failure", () => {
    const out = redactClickhouseUrl("garbage with a supersecret token");
    expect(out).toBe(UNPARSEABLE_CLICKHOUSE_URL);
    expect(out).not.toContain("supersecret");
  });
});
