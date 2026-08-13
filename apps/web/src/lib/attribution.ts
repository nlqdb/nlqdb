// SK-GTM-007 — first-party first-touch acquisition attribution.
//
// One localStorage slot (`nlqdb_src`) records the FIRST touch a device
// makes with any nlqdb page: UTM params, the external referrer host,
// and the landing pathname. `Base.astro` calls `captureFirstTouch()` on
// every page load; first write wins, so the channel that *brought* the
// visitor is what a later create/signup gets attributed to.
// `postAskCreate` forwards the slot as the `/v1/ask` `source` field and
// the API persists it on the created DB row (`databases.source_json`) —
// adoption re-tenants that row, so stranger signups stay attributable.
//
// Channel keys (`utm_source` values) are canonical in
// `docs/research/acquisition-channels.md` — every externally published
// nlqdb URL carries its ledger `utm_source`.

const SRC_KEY = "nlqdb_src";
const MAX_FIELD_LENGTH = 160;

/** Hosts treated as our own — a referrer from these is not a channel. */
const INTERNAL_HOST_SUFFIXES = ["nlqdb.com", "localhost", "127.0.0.1"];

export interface FirstTouch {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  /** External referrer hostname; absent for direct / internal navigation. */
  ref?: string;
  /** Pathname of the first page seen. */
  landing?: string;
  /** Epoch ms of the first touch. */
  ts: number;
}

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function clean(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_FIELD_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isInternalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return INTERNAL_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

function externalReferrerHost(referrer: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname;
    return host && !isInternalHost(host) ? clean(host) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Record the first touch if none is stored yet. Idempotent — an
 * existing valid slot always wins, so internal navigation never
 * overwrites the acquiring channel.
 */
export function captureFirstTouch(
  href: string = typeof window === "undefined" ? "" : window.location.href,
  referrer: string = typeof document === "undefined" ? "" : document.referrer,
  now: number = Date.now(),
): void {
  const ls = safeStorage();
  if (!ls || !href) return;
  if (loadFirstTouch() !== null) return;

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  const touch: FirstTouch = { ts: now };
  const utmSource = clean(url.searchParams.get("utm_source"));
  const utmMedium = clean(url.searchParams.get("utm_medium"));
  const utmCampaign = clean(url.searchParams.get("utm_campaign"));
  const ref = externalReferrerHost(referrer);
  const landing = clean(url.pathname);
  if (utmSource) touch.utm_source = utmSource;
  if (utmMedium) touch.utm_medium = utmMedium;
  if (utmCampaign) touch.utm_campaign = utmCampaign;
  if (ref) touch.ref = ref;
  if (landing) touch.landing = landing;

  try {
    ls.setItem(SRC_KEY, JSON.stringify(touch));
  } catch {
    // Quota/privacy-mode failure — attribution is never load-bearing.
  }
}

/**
 * Validate + clamp an untrusted `FirstTouch` (e.g. one arriving in a
 * cross-origin handoff fragment, `SK-ANON-015`). Returns null unless a
 * numeric `ts` is present — `loadFirstTouch` treats a `ts`-less blob as
 * corrupt, so a carry that dropped it would silently never read back.
 * String fields are trimmed + length-capped exactly like a fresh capture.
 */
export function sanitizeFirstTouch(input: unknown): FirstTouch | null {
  if (typeof input !== "object" || input === null) return null;
  const o = input as Record<string, unknown>;
  if (typeof o.ts !== "number" || !Number.isFinite(o.ts)) return null;
  const touch: FirstTouch = { ts: o.ts };
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "ref", "landing"] as const) {
    const v = clean(typeof o[key] === "string" ? (o[key] as string) : undefined);
    if (v) touch[key] = v;
  }
  return touch;
}

/**
 * Write a first touch carried in from another origin (`SK-ANON-015`).
 * Incoming wins, mirroring the `SK-ANON-011` draft rule: the acquiring
 * touch happened on the origin that sent the handoff (the marketing site),
 * which is strictly more authoritative than any capture the app origin
 * made from the post-OAuth referrer. Never load-bearing — drops on any
 * storage failure.
 */
export function importFirstTouch(touch: FirstTouch): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(SRC_KEY, JSON.stringify(touch));
  } catch {
    // Quota/privacy-mode — attribution is never load-bearing.
  }
}

/** The stored first touch, or null when absent/corrupt. */
export function loadFirstTouch(): FirstTouch | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(SRC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirstTouch;
    return typeof parsed === "object" && parsed !== null && typeof parsed.ts === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * The `/v1/ask` `source` field shape — the stored touch minus `ts`
 * (the API stamps its own row time), or null when nothing is stored.
 */
export function firstTouchSource(): Record<string, string> | null {
  const touch = loadFirstTouch();
  if (!touch) return null;
  const out: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "ref", "landing"] as const) {
    const v = touch[key];
    if (typeof v === "string" && v.length > 0) out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}
