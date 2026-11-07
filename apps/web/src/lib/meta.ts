// SERP meta for the data-driven `/solve`, `/vs` and `/blog` pages: the
// source field doubles as the on-page `<h1>`/lede, so a field over the SERP
// limit (~60 title / ~155 description) needs a hand-written `metaTitle` /
// `metaDescription`. There is no auto-truncation — a clipped "…" snippet
// cost clicks on page-1 results — so meta-length-integrity.test.ts fails any
// page that needs an override and lacks one.

const TITLE_MAX = 60;

// Longest-first: a title ending in ` — nlqdb blog` must not match ` — nlqdb`.
const TITLE_SUFFIXES = [" — nlqdb blog", " — natural-language databases", " — nlqdb"];

/** SERP meta description: the override when given, else `text` as-is. */
export function serpDescription(text: string, override?: string): string {
  return override ?? text.trim();
}

/** SERP meta title: the override when given, else `text` — minus a trailing
 * brand suffix (` — nlqdb`, ` — nlqdb blog`, ` — natural-language
 * databases`) when the full text is over the limit. */
export function serpTitle(text: string, override?: string): string {
  if (override) return override;
  const trimmed = text.trim();
  if (trimmed.length <= TITLE_MAX) return trimmed;
  for (const suffix of TITLE_SUFFIXES) {
    if (trimmed.endsWith(suffix)) {
      return trimmed.slice(0, -suffix.length).trim();
    }
  }
  return trimmed;
}
