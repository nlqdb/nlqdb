// Pure helpers for the keys dashboard (SK-APIKEYS-010 / SK-APIKEYS-012).
// Kept separate from `KeysPanel.tsx` so the grouping + summarization
// logic can be unit-tested without standing up a React renderer.

import type { KeyRecord } from "@nlqdb/sdk";

export type KeyGroups = {
  active: KeyRecord[];
  revoked: KeyRecord[];
};

// Splits a key list into active + revoked buckets. The server returns
// rows sorted by `(revoked_at IS NOT NULL), created_at DESC` so the
// natural order is preserved within each bucket; we only partition.
export function groupKeys(keys: KeyRecord[]): KeyGroups {
  const active: KeyRecord[] = [];
  const revoked: KeyRecord[] = [];
  for (const k of keys) {
    if (k.revokedAt === null) active.push(k);
    else revoked.push(k);
  }
  return { active, revoked };
}

export type KeySummary = {
  typeLabel: string;
  label: string;
  createdAtLabel: string;
  lastUsedAtLabel: string;
  // Non-null when the key has been revoked — the row's meta column
  // swaps `Last used` for `Revoked …` so a revoked row's audit trail
  // is visible at a glance.
  revokedAtLabel: string | null;
};

// Renders the human strings the list shows per row. Falls back to
// `…last4` when no label is set so a key minted without a name still
// has a stable identity.
export function summarizeKey(record: KeyRecord, now: number = Date.now()): KeySummary {
  return {
    typeLabel: typeLabel(record.keyType),
    label: humanLabel(record),
    createdAtLabel: formatRelative(record.createdAt, now),
    lastUsedAtLabel: record.lastUsedAt === null ? "never" : formatRelative(record.lastUsedAt, now),
    revokedAtLabel: record.revokedAt === null ? null : formatRelative(record.revokedAt, now),
  };
}

function typeLabel(keyType: KeyRecord["keyType"]): string {
  switch (keyType) {
    case "sk_live":
      return "sk_live";
    case "sk_mcp":
      return "sk_mcp";
    case "pk_live":
      return "pk_live";
    default:
      return keyType;
  }
}

function humanLabel(record: KeyRecord): string {
  if (record.name && record.name.trim().length > 0) return record.name;
  if (record.keyType === "sk_mcp" && record.mcpHost) {
    // `mcpHost`/`deviceId` are the canonical claim per SK-APIKEYS-004 —
    // surface them so users can disambiguate keys minted for the same
    // host on different machines.
    return record.deviceId ? `${record.mcpHost} · ${record.deviceId}` : record.mcpHost;
  }
  if (record.keyType === "pk_live" && record.dbId) return record.dbId;
  return "Untitled";
}

// Compact relative-time renderer. `epochSeconds` is the wire shape;
// the server stores `unixepoch()` integers and the SDK passes them
// through. Anything older than a year falls back to "1y+" so we don't
// chase precision on dead keys.
//
// `now` is injectable so tests are deterministic and don't drift on
// suite latency. Production callers pass `Date.now()` by default.
export function formatRelative(epochSeconds: number, now: number = Date.now()): string {
  const deltaSec = Math.max(0, Math.floor(now / 1000) - epochSeconds);
  if (deltaSec < 60) return "just now";
  const minutes = Math.floor(deltaSec / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return "1y+ ago";
}
