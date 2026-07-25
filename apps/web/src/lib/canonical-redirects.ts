// Why this file exists. `trailingSlash: "always"` means every page is
// `<route>/index.html`, so Cloudflare's asset router answers `/agents` with a
// *temporary* redirect to `/agents/`. Google's indexing pipeline only treats
// permanent codes (301/308) as a canonicalisation signal, so the bare URL stays
// in the index as its own entry, competing with the slashed twin instead of
// feeding it: the 2026-07-25 GSC pull had `/agents` at 4 impr / pos 6.8 and
// `/blog/llm-concatenates-columns-text-to-sql` at 2 impr / pos 15.5, both bare.
// Same class as `SK-WEB-026` (app-host duplicate), same remedy: a 301 in code.
//
// A `_redirects` file is the mechanism — it is evaluated ahead of the asset
// router and can express a permanent code, which `html_handling` cannot.
// (Scheme redirects still can't be expressed there — that gap stays zone-level
// per `GLOBAL-039`.)

/** Cloudflare's ceiling for static `_redirects` rules (wrangler's
 *  `MAX_STATIC_REDIRECT_RULES`); every line past it is skipped at upload. */
export const MAX_STATIC_RULES = 2000;

/** Prefixes no rule may cover. This build also ships to the merged app host
 *  (`apps/api/wrangler.toml` `[assets] directory = "../web/dist"`), where these
 *  are the app's own routes: `SK-WEB-026` bars the map from `/app|/auth|/oauth`
 *  and `SK-AUTH-016` reserves `/auth/*` from any server-side redirect. None is in
 *  `sitemap.xml`, so excluding them costs no indexable yield. */
const EXCLUDED_PREFIXES = ["/app", "/auth", "/oauth"];

const isExcluded = (p: string) =>
  EXCLUDED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));

/**
 * One `301` rule per built page, mapping its bare path to the slashed URL that
 * actually serves a 200.
 *
 * @param pagePaths  built page paths, slashless (`/agents`, `/blog/foo`)
 * @param hasFileAt  true when the bare path is itself a real asset — a rule
 *                   would shadow it (`/install` is a `curl … | sh` script)
 */
export function canonicalRedirectRules(
  pagePaths: string[],
  hasFileAt: (barePath: string) => boolean,
): string[] {
  const rules = pagePaths
    .filter((p) => p !== "" && p !== "/" && !isExcluded(p) && !hasFileAt(p))
    .sort()
    .map((p) => `${p} ${p}/ 301`);

  if (rules.length > MAX_STATIC_RULES) {
    throw new Error(
      `canonical-redirects: ${rules.length} rules exceeds Cloudflare's ${MAX_STATIC_RULES}-static-rule ceiling — wrangler would skip every line past it behind a single "Skipping remaining … lines of file" warning, so split the surface or switch to Bulk Redirects before shipping.`,
    );
  }
  return rules;
}
