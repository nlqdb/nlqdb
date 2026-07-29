---
"@nlqdb/cli": patch
---

Republish `@nlqdb/cli` so its registry manifest carries the `?utm_source=npm`
homepage tag. The tag was committed in-repo after `0.1.0` published, so the
served `0.1.0` still points its `homepage` at an untagged `https://nlqdb.com`
— every click-through from the package page converts as `direct`, invisible to
the GLOBAL-038 / SK-GTM-007 attribution the npm channel is meant to carry. This
is the CLI half of the acquisition-channels `/daily` republish task (the
`@nlqdb/sdk` half shipped in the 0.2.2 release). No code change — bin, shim and
postinstall are byte-identical; only the published manifest's homepage moves.
