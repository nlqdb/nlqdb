// Meta title/description clamps — decouple the SEO `<title>` / `<meta
// name="description">` from the on-page copy the data-driven templates
// render as `<h1>` and lede.
//
// The `/solve`, `/vs`, and `/blog` pages reuse one long source field for
// both the visible headline and the head meta. Search engines truncate a
// `<title>` past ~60 chars and a description past ~155 in the SERP, so the
// long-copy versions ship a clipped snippet. These clamps derive a
// SERP-fit meta from the same field WITHOUT touching the visible copy: the
// template passes the long field to the `<h1>` and the clamped value to
// `Base`. Each type carries an optional hand-written `metaTitle` /
// `metaDescription` override for the pages where an auto-clamp reads as an
// awkward fragment (SK-WEB-023 keeps the surface index-open, so the snippet
// is the click-through pitch — worth writing by hand on the highest-value
// pages).

const DESCRIPTION_MAX = 155;
const TITLE_MAX = 60;

// Longest-first: a title ending in ` — nlqdb blog` must not match ` — nlqdb`.
const TITLE_SUFFIXES = [" — nlqdb blog", " — natural-language databases", " — nlqdb"];

// Truncate on a word boundary to at most `max` chars, appending `…` only if
// it actually truncated. Returns the trimmed input unchanged when it already
// fits. One char is reserved for the ellipsis so the result never exceeds
// `max` — the length the guard test (`meta-length-integrity.test.ts`) asserts.
function smartClamp(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const body = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${body.replace(/[\s.,;:—–-]+$/, "")}…`;
}

/** SERP-fit meta description: the override when given, else a ≤155-char
 * word-boundary clamp of `text`. */
export function clampDescription(text: string, override?: string): string {
  return override ?? smartClamp(text, DESCRIPTION_MAX);
}

/** SERP-fit meta title: the override when given, else a ≤60-char version —
 * drop a trailing brand suffix (` — nlqdb`, ` — nlqdb blog`, ` —
 * natural-language databases`) first, then word-boundary truncate if still
 * over. Never cuts mid-word. */
export function clampTitle(text: string, override?: string): string {
  if (override) return override;
  const trimmed = text.trim();
  if (trimmed.length <= TITLE_MAX) return trimmed;
  for (const suffix of TITLE_SUFFIXES) {
    if (trimmed.endsWith(suffix)) {
      const base = trimmed.slice(0, -suffix.length).trim();
      return base.length <= TITLE_MAX ? base : smartClamp(base, TITLE_MAX);
    }
  }
  return smartClamp(trimmed, TITLE_MAX);
}
