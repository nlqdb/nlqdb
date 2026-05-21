// SK-GATE-007 — auto-invite issuance for waitlist signups.
// Generates a 128-bit code, writes its SHA-256 prefix to KV under the
// same `gate:invite:` key-space the bypass middleware reads, and keeps
// a rolling weekly counter so the free-LLM quota is protected.

import { sha256Hex } from "./principal.ts";

const INVITE_PREFIX = "gate:invite:";
const CAP_PREFIX = "wl:invite-cap:";
const INVITE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const CAP_TTL_SECONDS = 8 * 24 * 60 * 60;     // 8-day window — outlasts one full week

export function generateInviteCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // base64url without padding: 16 bytes = 128 bits of entropy, 22 chars
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function weekKey(): string {
  // Stable 7-day bucket aligned to the Unix epoch.
  return `${CAP_PREFIX}${Math.floor(Date.now() / (7 * 86_400_000))}`;
}

// Returns the invite code if issued, null if the weekly cap is exhausted.
// Fail-fast on KV errors so the caller can catch+warn without crashing the
// waitlist signup — invite email is best-effort, the 200 still ships.
export async function tryIssueInvite(kv: KVNamespace, weekCap: number): Promise<string | null> {
  const capKey = weekKey();
  const raw = await kv.get(capKey);
  const count = raw ? Number(raw) : 0;
  if (count >= weekCap) return null;

  const code = generateInviteCode();
  const hash = await sha256Hex(code, 32);

  await Promise.all([
    kv.put(`${INVITE_PREFIX}${hash}`, "1", { expirationTtl: INVITE_TTL_SECONDS }),
    kv.put(capKey, String(count + 1), { expirationTtl: CAP_TTL_SECONDS }),
  ]);

  return code;
}

export function buildInviteEmail(_email: string, code: string): { subject: string; text: string; html: string } {
  const link = `https://app.nlqdb.com/?invite=${code}`;
  return {
    subject: "You're in — your nlqdb invite",
    text: [
      "Here is your early-access invite code:",
      "",
      `  ${code}`,
      "",
      `Open this link and start building: ${link}`,
      "",
      "It works via the web app, SDK, CLI, or MCP — just add:",
      `  X-Invite-Code: ${code}`,
      "to any API request, or use --invite-code with the CLI.",
      "",
      "The invite is valid for 30 days.",
      "",
      "— nlqdb",
      "Feedback → hello@nlqdb.com",
    ].join("\n"),
    html: `<!DOCTYPE html>
<html>
<body style="font-family:monospace;max-width:560px;margin:40px auto;color:#ccc;background:#111;padding:32px;border:2px solid #333">
<h2 style="color:#fff;margin:0 0 16px">You're in.</h2>
<p style="margin:0 0 12px">Your early-access invite code:</p>
<pre style="background:#222;padding:16px;border:2px solid #0ff;color:#0ff;font-size:18px;letter-spacing:0.05em">${code}</pre>
<p style="margin:16px 0 8px">Open this link to start building:</p>
<a href="${link}" style="color:#0ff;word-break:break-all">${link}</a>
<p style="margin:24px 0 0;color:#666;font-size:12px">
  The invite also works via the SDK (<code>createClient({ inviteCode: "..." })</code>),
  CLI (<code>--invite-code</code>), or raw API (<code>X-Invite-Code</code> header).
  Valid for 30 days. Questions? <a href="mailto:hello@nlqdb.com" style="color:#888">hello@nlqdb.com</a>
</p>
</body>
</html>`,
  };
}
