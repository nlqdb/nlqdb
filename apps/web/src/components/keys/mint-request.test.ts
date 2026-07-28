// `mintRequestFromForm` — the `/app/keys` mint dialog's form → wire mapping
// (SK-APIKEYS-015). The type picker is the only place a user chooses between
// the account-scoped `sk_live_` and the MCP-scoped `sk_mcp_`, so the shape it
// produces is worth pinning: an `sk_mcp` request without its `(host, device)`
// claims would mint a key nobody can revoke per host (SK-APIKEYS-004).

import { describe, expect, it } from "vitest";
import {
  DEVICE_MAX,
  EMPTY_MINT_FORM,
  HOST_MAX,
  mintRequestFromForm,
  NAME_MAX,
} from "./mint-request";

describe("mintRequestFromForm — sk_live", () => {
  it("defaults to sk_live with no label", () => {
    const out = mintRequestFromForm(EMPTY_MINT_FORM);
    expect(out).toEqual({ ok: true, request: { type: "sk_live" } });
  });

  it("trims the label and omits it when blank", () => {
    expect(mintRequestFromForm({ ...EMPTY_MINT_FORM, name: "  ci-deploy " })).toEqual({
      ok: true,
      request: { type: "sk_live", name: "ci-deploy" },
    });
    expect(mintRequestFromForm({ ...EMPTY_MINT_FORM, name: "   " })).toEqual({
      ok: true,
      request: { type: "sk_live" },
    });
  });

  it("rejects a label past the route's cap", () => {
    const out = mintRequestFromForm({ ...EMPTY_MINT_FORM, name: "x".repeat(NAME_MAX + 1) });
    expect(out.ok).toBe(false);
  });

  it("ignores stale MCP claims left behind by a type switch", () => {
    const out = mintRequestFromForm({
      type: "sk_live",
      name: "ci",
      host: "cursor",
      device: "macbook",
    });
    expect(out).toEqual({ ok: true, request: { type: "sk_live", name: "ci" } });
  });
});

describe("mintRequestFromForm — sk_mcp", () => {
  it("emits both claims, trimmed", () => {
    const out = mintRequestFromForm({
      type: "sk_mcp",
      name: "ignored",
      host: " cursor ",
      device: " macbook-air ",
    });
    expect(out).toEqual({
      ok: true,
      request: { type: "sk_mcp", host: "cursor", device: "macbook-air" },
    });
  });

  it("refuses a key missing either claim — revocation is per host per device", () => {
    for (const [host, device] of [
      ["", "macbook"],
      ["cursor", ""],
      ["", ""],
      ["   ", "macbook"],
    ]) {
      const out = mintRequestFromForm({ ...EMPTY_MINT_FORM, type: "sk_mcp", host, device });
      expect(out.ok).toBe(false);
    }
  });

  it("rejects claims past the route's caps", () => {
    expect(
      mintRequestFromForm({
        ...EMPTY_MINT_FORM,
        type: "sk_mcp",
        host: "h".repeat(HOST_MAX + 1),
        device: "d",
      }).ok,
    ).toBe(false);
    expect(
      mintRequestFromForm({
        ...EMPTY_MINT_FORM,
        type: "sk_mcp",
        host: "h",
        device: "d".repeat(DEVICE_MAX + 1),
      }).ok,
    ).toBe(false);
  });
});
