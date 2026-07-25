// Bare internal paths are 307s. `trailingSlash: "always"` means every page is
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

/** Cloudflare's ceiling for static `_redirects` rules; extra rules are dropped. */
export const MAX_STATIC_RULES = 2000;

/** `/app*` bare paths belong to `worker.ts`, which 301s them to the merged app
 *  on `app.nlqdb.com` (SK-AUTH-016) — leave that chain exactly as documented. */
const WORKER_OWNED = "/app";

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
    .filter(
      (p) =>
        p !== "" &&
        p !== "/" &&
        p !== WORKER_OWNED &&
        !p.startsWith(`${WORKER_OWNED}/`) &&
        !hasFileAt(p),
    )
    .sort()
    .map((p) => `${p} ${p}/ 301`);

  if (rules.length > MAX_STATIC_RULES) {
    throw new Error(
      `canonical-redirects: ${rules.length} rules exceeds Cloudflare's ${MAX_STATIC_RULES}-static-rule ceiling — rules past it are silently dropped, so split the surface or switch to a dynamic rule before shipping.`,
    );
  }
  return rules;
}
