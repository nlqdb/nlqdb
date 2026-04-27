// Parses a refresh-interval attribute value: "60s", "5m", "500ms", or
// a plain integer (ms). Returns null for any malformed input — the
// element treats null as "no refresh" rather than failing visibly,
// since a bad attribute value should not break the rest of the page.
export function parseRefresh(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d+)\s*(ms|s|m)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2] ?? "ms";
  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60_000;
    default:
      return null;
  }
}
