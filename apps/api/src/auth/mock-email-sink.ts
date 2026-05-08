// KV-backed sink for mock-mode email. Active only when env.MOCK_IDP === "1"
// (see SK-AUTH-018). Writes one entry per send under a timestamped key
// + lists by prefix so `GET /api/dev/inbox` can return the captured
// magic-link URLs without ever touching Resend.
//
// Entries TTL out after an hour — long enough for any preview-driven
// test to redeem the link, short enough that abandoned previews don't
// accumulate KV state.

const KEY_PREFIX = "mock-email:";
const ENTRY_TTL_SECONDS = 3600;

export type MockEmailEntry = {
  to: string;
  subject: string;
  body: string;
  ts: number;
};

export async function sinkEmail(
  kv: KVNamespace,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  const ts = Date.now();
  const key = `${KEY_PREFIX}${ts}-${to}`;
  const entry: MockEmailEntry = { to, subject, body, ts };
  await kv.put(key, JSON.stringify(entry), { expirationTtl: ENTRY_TTL_SECONDS });
}

export async function listInbox(kv: KVNamespace): Promise<MockEmailEntry[]> {
  const list = await kv.list({ prefix: KEY_PREFIX });
  const items = await Promise.all(
    list.keys.map(async (k) => {
      const v = await kv.get(k.name);
      if (!v) return null;
      try {
        return JSON.parse(v) as MockEmailEntry;
      } catch {
        return null;
      }
    }),
  );
  return items.filter((x): x is MockEmailEntry => x !== null).sort((a, b) => b.ts - a.ts);
}

export async function findLatestForEmail(
  kv: KVNamespace,
  to: string,
): Promise<MockEmailEntry | null> {
  const items = await listInbox(kv);
  return items.find((i) => i.to === to) ?? null;
}
