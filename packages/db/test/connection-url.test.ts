import { describe, expect, it } from "vitest";
import {
  parseConnectionUrl,
  redactConnectionUrl,
  UNPARSEABLE_CONNECTION_URL,
} from "../src/index.ts";

// SK-DB-012 — the BYO-connection-URL primitive. Two guarantees under test:
// (1) it fails loud at the wire boundary on anything a driver couldn't use
// (GLOBAL-012), and (2) the password — and the whole query string, which
// can carry `password=` / `sslpassword=` — never survives into the redacted
// display form (the only form allowed on a span / log / UI per §3.6.7).

describe("parseConnectionUrl — accepts valid Postgres URLs", () => {
  it("parses a full URL and strips the password + query from the redacted form", () => {
    const result = parseConnectionUrl(
      "postgres://alice:supersecret@db.example.com:5432/shop?sslmode=require",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed).toEqual({
      redacted: "postgres://alice@db.example.com:5432/shop",
      host: "db.example.com",
      port: 5432,
      database: "shop",
      user: "alice",
    });
    expect(result.parsed.redacted).not.toContain("supersecret");
    expect(result.parsed.redacted).not.toContain("sslmode");
  });

  it("accepts the postgresql:// scheme", () => {
    const result = parseConnectionUrl("postgresql://u:p@host/db");
    expect(result.ok).toBe(true);
  });

  it("accepts a Neon-shaped URL", () => {
    const result = parseConnectionUrl(
      "postgres://owner:pw@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.redacted).toBe(
      "postgres://owner@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb",
    );
    expect(result.parsed.port).toBeNull();
  });

  it("accepts an absent password", () => {
    const result = parseConnectionUrl("postgres://alice@host/db");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.redacted).toBe("postgres://alice@host/db");
  });

  it("accepts an absent user (no leading @ in the redacted form)", () => {
    const result = parseConnectionUrl("postgres://host/db");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.user).toBeNull();
    expect(result.parsed.redacted).toBe("postgres://host/db");
  });

  it("handles an IPv6 host with a port", () => {
    const result = parseConnectionUrl("postgres://u:p@[::1]:6543/db");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.host).toBe("[::1]");
    expect(result.parsed.port).toBe(6543);
    expect(result.parsed.redacted).toBe("postgres://u@[::1]:6543/db");
  });

  it("trims surrounding whitespace", () => {
    const result = parseConnectionUrl("  postgres://u:p@host/db  ");
    expect(result.ok).toBe(true);
  });
});

describe("parseConnectionUrl — rejects unusable input (GLOBAL-012)", () => {
  it("rejects an empty / whitespace-only string", () => {
    for (const raw of ["", "   "]) {
      const result = parseConnectionUrl(raw);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.message).toMatch(/empty/i);
    }
  });

  it("rejects a non-URL string", () => {
    const result = parseConnectionUrl("definitely not a url");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/malformed/i);
  });

  it("rejects a non-Postgres scheme and names it", () => {
    const result = parseConnectionUrl("mysql://u:p@host/db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("mysql");
    expect(result.message).toMatch(/postgres/);
  });

  it("rejects a missing host", () => {
    const result = parseConnectionUrl("postgres:///db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/host/i);
  });

  it("rejects a missing database name", () => {
    const result = parseConnectionUrl("postgres://alice@host");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/database/i);
  });

  it("rejects a comma-separated multi-host URL", () => {
    // WHATWG URL keeps the comma in hostname ("h1,h2"); reject it rather
    // than seal an unconnectable host. The port-bearing form throws and is
    // reported as malformed, which is also a rejection.
    const result = parseConnectionUrl("postgres://u:p@h1,h2/db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/host/i);
    expect(parseConnectionUrl("postgresql://h1:5432,h2:5433/db").ok).toBe(false);
  });

  it("rejects a multi-segment path", () => {
    const result = parseConnectionUrl("postgres://host/db/extra");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/path|database/i);
  });

  it("never echoes a secret in a rejection message", () => {
    const result = parseConnectionUrl("mysql://u:supersecret@host/db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toContain("supersecret");
  });
});

describe("redactConnectionUrl", () => {
  it("returns the password-stripped display form for a valid URL", () => {
    expect(redactConnectionUrl("postgres://u:p@host:5432/db?sslmode=require")).toBe(
      "postgres://u@host:5432/db",
    );
  });

  it("returns the sentinel and never echoes the input on a parse failure", () => {
    const out = redactConnectionUrl("garbage with a supersecret token");
    expect(out).toBe(UNPARSEABLE_CONNECTION_URL);
    expect(out).not.toContain("supersecret");
  });
});
