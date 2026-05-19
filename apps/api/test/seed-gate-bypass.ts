// `GLOBAL-027` is closed today, which would block every existing
// `/v1/ask` / `/v1/run` / `POST /v1/databases` / `POST /v1/chat/messages`
// integration test with 403 `feature_gated`. This setup seeds an
// invite code into Miniflare's per-test KV; failing tests opt in by
// sending `X-Invite-Code: TEST_INVITE` and clear the gate.
//
// DO NOT reuse this code in production. `isolatedStorage: true` in
// vitest.config.ts keeps it inside the test fixture.

import { env } from "cloudflare:test";
import { beforeAll } from "vitest";

export const TEST_INVITE_CODE = "TEST_INVITE";

async function sha256Hex(input: string, chars: number): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, chars);
}

beforeAll(async () => {
  if (!env.KV) {
    throw new Error("KV binding missing — seed-gate-bypass requires env.KV");
  }
  const hash = await sha256Hex(TEST_INVITE_CODE, 32);
  await env.KV.put(`gate:invite:${hash}`, "1");
});
