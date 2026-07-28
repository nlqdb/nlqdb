// Pure form → `MintKeyRequest` mapping for the `/app/keys` mint dialog
// (SK-APIKEYS-015). Kept out of `KeysPanel.tsx` so the validation the
// dialog enforces client-side is unit-testable without a React renderer,
// and so the caps stay visibly pinned to the route's own bounds.

import type { MintKeyRequest } from "@nlqdb/sdk";

// Mirrors `KEY_NAME_MAX` / `MCP_HOST_MAX` / `DEVICE_ID_MAX` in
// `apps/api/src/index.ts`. The server is the authority — these exist so a
// too-long value fails in the dialog instead of costing a round-trip.
export const NAME_MAX = 80;
export const HOST_MAX = 32;
export const DEVICE_MAX = 64;

export type MintForm = {
  type: "sk_live" | "sk_mcp";
  // `sk_live` label. Optional — an unlabeled key renders as `…last4`.
  name: string;
  // `sk_mcp` claims (SK-APIKEYS-004). Required for that type: they are the
  // revocation + attribution unit, so a key without them is not mintable.
  host: string;
  device: string;
};

export const EMPTY_MINT_FORM: MintForm = { type: "sk_live", name: "", host: "", device: "" };

export type MintFormResult = { ok: true; request: MintKeyRequest } | { ok: false; error: string };

// Trims, validates, and narrows the form to the wire request. Returns the
// user-facing message on failure so the dialog has nothing to decide.
export function mintRequestFromForm(form: MintForm): MintFormResult {
  if (form.type === "sk_live") {
    const name = form.name.trim();
    if (name.length > NAME_MAX)
      return { ok: false, error: `Label must be ${NAME_MAX} characters or fewer.` };
    return { ok: true, request: { type: "sk_live", ...(name ? { name } : {}) } };
  }
  const host = form.host.trim();
  const device = form.device.trim();
  if (!host || !device) {
    return {
      ok: false,
      error: "MCP keys need both a host and a device — they are what you revoke.",
    };
  }
  if (host.length > HOST_MAX)
    return { ok: false, error: `Host must be ${HOST_MAX} characters or fewer.` };
  if (device.length > DEVICE_MAX) {
    return { ok: false, error: `Device must be ${DEVICE_MAX} characters or fewer.` };
  }
  return { ok: true, request: { type: "sk_mcp", host, device } };
}
