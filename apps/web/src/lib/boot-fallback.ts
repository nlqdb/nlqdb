// Tested copy of the `is:inline` boot-script filter in `Base.astro` (SK-WEB-001) — keep the two in sync.

export interface BootErrorLike {
  filename?: string | null;
}

export function isExternalNoise(event: BootErrorLike | null | undefined, message: string): boolean {
  // Cross-origin throws get anonymised to this exact string with no usable stack.
  if (message === "Script error.") return true;
  const filename = event?.filename ? String(event.filename) : "";
  if (!filename) return false;
  // Browser-extension content scripts (Chromium / Firefox / Safari v14+ / Safari pre-14 / WebKit content-isolation) — mirrors Sentry's standard denylist.
  if (filename.startsWith("chrome-extension://")) return true;
  if (filename.startsWith("moz-extension://")) return true;
  if (filename.startsWith("safari-web-extension://")) return true;
  if (filename.startsWith("safari-extension://")) return true;
  if (filename.startsWith("webkit-masked-url://")) return true;
  return false;
}
