---
"@nlqdb/sdk": patch
---

Give the npm package page a way in. The README — the page npmjs.com renders —
documented every verb but linked nowhere: a developer who discovered the
canonical HTTP client on npm had no path to the product, the docs, or the API
key the `## Auth` section assumes they already hold. Added a lead-in linking
`nlqdb.com`, `docs.nlqdb.com/sdk`, and `app.nlqdb.com/app/keys`, with the two
landing URLs `?utm_source=npm`-tagged so a click-through stops converting as
`direct` (SK-GTM-007). Guarded by `test/readme.test.ts`.
