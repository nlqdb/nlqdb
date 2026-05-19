// Integration-suite gate bypass. The `GLOBAL-027` pre-alpha gate is
// closed today (BIRD 0.318, Spider null), which would block every
// existing `/v1/ask` / `/v1/run` / `POST /v1/databases` /
// `POST /v1/chat/messages` integration test with 403 `feature_gated`.
// To keep the existing seams (principal-gate, body-parse, orchestrator
// behavior) testable, this setup pre-seeds the test Miniflare KV with
// a known invite code; failing tests opt in by sending
// `X-Invite-Code: TEST_INVITE` and clear the gate.
//
// **Do NOT use this code in production.** It only exists in the
// per-test isolated KV namespace (`isolatedStorage: true` in
// vitest.config.ts), so it never escapes the test fixture.

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
