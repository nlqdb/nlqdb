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
      return !!ok["trace"] && typeof ok["trace"] === "object";
    }
    case "needs-confirm":
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
  const state = r["state"];
  if (!state || typeof state !== "object") return false;
  return isValidReplyState(state as Record<string, unknown>);
}
