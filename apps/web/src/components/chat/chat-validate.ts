// Shape gate for persisted `Message[]` history (SK-WEB-001).
//
// `localStorage` survives across releases, so any tab loading a chat
// history written by an older build can hand the panel a stale shape
// whose fields a renderer would crash on. Run every entry through
// `matchesValidMessageShape` before passing to React. Lives in its
// own file (no JSX, no React imports) so the unit suite can load it
// without standing up the JSX runtime.

// Per-`kind` shape gates. Each branch drops entries whose fields would
// either crash render (`ambiguous.candidates.map(...)`) or print
// `undefined` into user-visible copy (`created.displayName`). Unknown
// `kind` values are rejected so a future state introduced by a newer
// build doesn't silently survive a downgrade.
function isValidReplyState(s: Record<string, unknown>): boolean {
  switch (s["kind"]) {
    case "pending":
      return true;
    case "ok": {
      const ok = s["ok"] as Record<string, unknown> | undefined;
      if (!ok || typeof ok !== "object") return false;
      const t = ok["trace"] as Record<string, unknown> | undefined;
      if (!t || typeof t !== "object") return false;
      // `Trace.tsx` renders `meta.plan_id` directly; an `ok` reply
      // whose persisted `trace` block lacks `plan_id` would print
      // `undefined` into the trace pane's identifier slot. Require
      // it as a string at the gate so we drop the entry instead.
      return typeof t["plan_id"] === "string";
    }
    case "needs-confirm":
      // `loadHistory` rewrites `needs-confirm` to `error` on rehydrate
      // — `DiffChip` never sees a stale `needs-confirm` in practice.
      // Same is true for `pending` / `clarify` / `ambiguous` below.
      // The check here just gates "well-formed enough to normalise".
      return !!s["diff"] && typeof s["diff"] === "object";
    case "created":
      return (
        typeof s["displayName"] === "string" &&
        typeof s["dbId"] === "string" &&
        typeof s["tableCount"] === "number" &&
        typeof s["sampleRowCount"] === "number"
      );
    case "ambiguous": {
      if (!Array.isArray(s["candidates"])) return false;
      if (typeof s["reason"] !== "string") return false;
      return s["candidates"].every(
        (c) =>
          !!c &&
          typeof c === "object" &&
          typeof (c as Record<string, unknown>)["id"] === "string" &&
          typeof (c as Record<string, unknown>)["slug"] === "string",
      );
    }
    case "clarify": {
      const pinnedDb = s["pinnedDb"];
      if (pinnedDb === null) return true;
      if (!pinnedDb || typeof pinnedDb !== "object") return false;
      const p = pinnedDb as Record<string, unknown>;
      return typeof p["id"] === "string" && typeof p["slug"] === "string";
    }
    case "feature_gated": {
      // Validate every field the view dereferences — `.toFixed` throws on a non-number accuracy.
      if (typeof s["message"] !== "string") return false;
      if (typeof s["waitlistUrl"] !== "string") return false;
      const gate = s["gate"];
      if (!gate || typeof gate !== "object") return false;
      const g = gate as Record<string, unknown>;
      return (
        typeof g["bird_target"] === "number" &&
        typeof g["spider_target"] === "number" &&
        (g["bird_accuracy"] === null || typeof g["bird_accuracy"] === "number") &&
        (g["spider_accuracy"] === null || typeof g["spider_accuracy"] === "number")
      );
    }
    case "error":
      return typeof s["message"] === "string";
    default:
      return false;
  }
}

export function matchesValidMessageShape(m: unknown): boolean {
  if (!m || typeof m !== "object") return false;
  const obj = m as Record<string, unknown>;
  if (typeof obj["id"] !== "string") return false;
  if (obj["role"] === "user") return typeof obj["goal"] === "string";
  if (obj["role"] !== "assistant") return false;
  const reply = obj["reply"];
  if (!reply || typeof reply !== "object") return false;
  const r = reply as Record<string, unknown>;
  if (typeof r["id"] !== "string" || typeof r["goal"] !== "string") return false;
  // `Trace.tsx` calls `.length` and `.map` on `reply.steps`. `saveHistory`
  // always writes `[]`, but the validator's job is to reject hostile or
  // older-build shapes — a non-array `steps` would crash render.
  if (!Array.isArray(r["steps"])) return false;
  const state = r["state"];
  if (!state || typeof state !== "object") return false;
  return isValidReplyState(state as Record<string, unknown>);
}
