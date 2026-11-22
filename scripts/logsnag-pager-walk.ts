// Run: bun scripts/logsnag-pager-walk.ts — prints LogSnag rows / pushes (SK-EVENTS-006).
// Replays the pr-1297 review walk: 30 magic-link 500s with distinct emails,
// plus four aggregate events and one page, through reportAuthServerError → envelope
// → the events-worker queue handler; counts LogSnag rows and pushes.
import { type EventEnvelope, makeQueueEmitter, type ProductEvent } from "@nlqdb/events";
import { reportAuthServerError } from "../apps/api/src/auth/failure-report.ts";
import handler from "../apps/events-worker/src/index.ts";

const store = new Map<string, string>();
const kv = {
  get: async (k: string) => store.get(k) ?? null,
  put: async (k: string, v: string) => void store.set(k, v),
} as unknown as KVNamespace;
const queued: EventEnvelope[] = [];
const events = makeQueueEmitter({ send: async (e) => void queued.push(e) });
for (let i = 0; i < 30; i++) {
  await reportAuthServerError({
    env: { KV: kv } as never,
    events,
    req: new Request("https://app.nlqdb.com/api/auth/sign-in/magic-link", { method: "POST" }),
    body: JSON.stringify({ email: `walker${i}@example.com` }),
    status: 500,
    utcDay: "2026-11-21",
    thrown: true,
  });
}
const aggregates: ProductEvent[] = [
  { name: "feature.requested.heavier_tier", principalId: "a", surface: "chat" },
  { name: "home.surface_wishlist", principalId: "wl:a", surface: "vscode" },
  { name: "pricing.page_viewed", principalId: "a", email: null },
  {
    name: "db.created",
    dbId: "db_1",
    principalId: "a",
    anon: true,
    engine: "postgres",
    preset: false,
    tableCount: 1,
    synthetic: false,
  },
  { name: "user.registered", userId: "u_1", email: "new@example.com" },
];
for (const e of aggregates) await events.emit(e);

let rows = 0,
  pushes = 0,
  posthog = 0;
globalThis.fetch = (async (url: string, init: RequestInit) => {
  if (url.includes("logsnag")) {
    rows++;
    if (JSON.parse(String(init.body)).notify) pushes++;
  }
  if (url.includes("posthog")) posthog += JSON.parse(String(init.body)).batch.length;
  return new Response("{}", { status: 200 });
}) as typeof fetch;
const messages = queued.map((body) => ({
  id: body.id,
  body,
  timestamp: new Date(),
  attempts: 0,
  ack() {},
  retry() {},
}));
if (!handler.queue) throw new Error("events-worker exports no queue handler");
await handler.queue(
  { messages, queue: "nlqdb-events" } as never,
  {
    LOGSNAG_TOKEN: "t",
    LOGSNAG_PROJECT: "p",
    POSTHOG_API_KEY: "k",
    POSTHOG_HOST: "https://eu.i.posthog.com",
  } as never,
  { waitUntil() {} } as never,
);
console.log(
  JSON.stringify({
    enqueued: queued.length,
    logsnagRows: rows,
    logsnagPushes: pushes,
    posthogEvents: posthog,
  }),
);
