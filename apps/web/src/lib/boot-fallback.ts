// Shared logic for the pre-hydration boot-fallback in `Base.astro`
// (SK-WEB-001). The `<script is:inline>` boot loader in the layout
// hand-copies `isExternalNoise` because an inline script can't
// `import` — this module exists so the rule is unit-tested. Keep the
// inline copy in sync.
//
// Why this matters: production showed the boot-fallback panel painted
// under the footer of healthy marketing pages. Two compounding causes:
//   (a) The reveal gate (`window.__nlqdbBooted`) was only set by a
//       React island's `componentDidMount`, so static pages never
//       closed the gate — any throw revealed the panel.
//   (b) `window.error` fires for browser extensions, cross-origin
//       analytics scripts, and ad-blocker shims. These have nothing
//       to do with our code but were treated as fatal boot errors.
// Filtering noise here means we neither paint the panel nor POST the
// event to `/v1/errors/web`, keeping the observability pipeline clean.

export interface BootErrorLike {
  filename?: string | null;
}

export function isExternalNoise(event: BootErrorLike | null | undefined, message: string): boolean {
  // The browser anonymises cross-origin script errors to this exact
  // string with no usable stack / filename — nothing actionable.
  if (message === "Script error.") return true;
  const filename = event?.filename ? String(event.filename) : "";
  if (!filename) return false;
  // Browser-extension content scripts. All five prefixes are real:
  // Chromium browsers (Chrome / Edge / Brave / Opera / Arc) use
  // chrome-extension://, Firefox uses moz-extension://, Safari uses
  // safari-web-extension:// (v14+) and safari-extension:// (older).
  // webkit-masked-url:// is Safari's obfuscation for extension code
  // running under content-isolation. List mirrors the standard noise
  // denylist shipped by Sentry / Bugsnag.
  if (filename.startsWith("chrome-extension://")) return true;
  if (filename.startsWith("moz-extension://")) return true;
  if (filename.startsWith("safari-web-extension://")) return true;
  if (filename.startsWith("safari-extension://")) return true;
  if (filename.startsWith("webkit-masked-url://")) return true;
  return false;
}
