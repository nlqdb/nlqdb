# D-08 — Goal pack #1 as a one-click repo-memory import

**Status:** in flight — **runner core landed 2026-08-10** (founder
direct-ordered to unblock EK-04/EK-05); public alpha until explicit founder
promotion
**Sequence:** productization follow-on to D-01 · **Risk:** high · **Runs:** multi ·
**Prereqs:** D-01, D-04, E-06, `SK-HDC-016` delete · **Gate:** none

## Goal

Turn the shipped repo-ops recipe from an expert-installed skill into the first
[`SK-PIVOT-021`](../../decisions/SK-PIVOT-021-one-click-goal-pack-journeys.md)
product journey:

> Paste a GitHub repository URL → **Import repo memory** → inspect useful
> preflight evidence → complete only the unavoidable identity/provider consent
> → watch the real extraction strategy execute → query the result.

There is one nlqdb action. Sign-in and private-repository consent may require
provider interactions, but every redirect resumes the same import
automatically: the repository URL, selected ref, scan, strategy and progress
are never re-entered.

This is a **public alpha**, not a founder-only surface. The founder manually
walks and deletes each test import while it is being perfected; the alpha label
is removed only by explicit founder approval after the acceptance journey
below passes in production shape.

## Discovery and leverage

Existing instances:

- D-01 already defines the repo-ops extraction recipe and public MCP behavior.
- `SK-PIVOT-018` defines packs as declarative recipes on `agent_memory_v1`.
- `SK-WEB-019` already preserves `return_to` through an auth-guarded product
  flow.
- `SK-HDC-016` already deletes an isolated hosted DB and its keys safely.

This is instance #1 of the shared **source → preview → pack runner → memory**
category, not a repo-ops-only importer.

**N+1:** pack #2 supplies source/configuration, extraction categories and result
queries to the same runner. It does not rebuild auth, resumability, progress,
verification or cleanup.

## Journey contract

### 1. One entry and one product action

`/agents` presents a GitHub repository URL field and one primary
**Import repo memory** CTA. The copy says “import,” never “migrate”: markdown
stays canonical and nlqdb creates a derived index (`SK-PIVOT-017`).

Clicking creates a short-lived server-side import draft and puts only its
opaque ID in the resumable URL. The draft pins repository, ref/commit, scan
results and current phase; no repository content or credential appears in the
URL or browser storage.

### 2. Public repository: useful evidence before sign-in

For a public repository, inspect without GitHub authorization:

- resolve and pin the default branch commit;
- fetch the public source archive;
- count all files and classify eligible/skipped files;
- render the proposed memory strategy before any write.

This preflight is the `GLOBAL-007` first value. GitHub documents that public
repository data and source archives can be fetched without authentication;
unauthenticated REST traffic is limited to 60 requests/hour per originating
IP, so the archive path is preferred over one request per file. The recursive
tree endpoint may support the count/index pass (up to 100,000 entries / 7 MB)
but is not the file-download loop.

After the evidence appears, an anonymous user is sent through nlqdb sign-in
with `return_to=<import URL>`. The callback resumes persistence automatically;
there is no second product confirmation and no repeated repository input.

### 3. Private repository: least-privilege GitHub access only when needed

If anonymous inspection returns private/not-found, first preserve the import
draft through nlqdb sign-in. Then request a separate **GitHub App**
installation with read-only repository Contents access and “Only select
repositories,” preselecting the requested repo where GitHub permits it.

Do not widen the existing GitHub OAuth sign-in app: `SK-AUTH-008` deliberately
made it identity-only, while GitHub recommends GitHub Apps for granular,
selected-repository permissions and short-lived tokens. The installation
callback returns to the same import URL and resumes automatically. Denial
keeps the draft and offers exactly two actions: retry authorization or choose a
public repository.

Public imports never ask for GitHub authorization merely to improve rate
limits. If the anonymous path is temporarily rate-limited, explain that
precisely and offer GitHub authorization as an optional faster path or a retry
after the reset time.

### 4. Honest preview and progress

Before writes begin, show:

- repository, pinned commit and total file count;
- eligible files and skipped files, expandable by path and reason;
- planned writes by memory object;
- the exact extraction categories below.

| Repository structure | Memory strategy |
|---|---|
| Decisions / ADRs | entity for the ID; facts for status/date/supersession |
| Open questions | fact with source path, stable key and first-seen date |
| Queues / trackers / ledgers | entity plus state, blocked reason and date facts |
| Cross-references | tags plus `entity_facts` edges |
| Sync run | episode with commit and reconciled counts |
| Narrative prose, binaries, generated/vendor files | skip with a visible reason |
| Credential references | metadata only; secret values are rejected |

The execution view uses real counters, not a spinner or synthetic percentage:

1. **Inspecting** — files discovered / total.
2. **Classifying** — eligible / skipped, with category counts.
3. **Extracting** — structured records produced per category.
4. **Saving to memory** — entities, facts, edges and episodes written.
5. **Verifying** — written counts reconciled and the pack's golden queries run.

Refresh, back/forward navigation, a dropped connection and sign-in/provider
round trips reopen the same phase. A retry continues idempotently from the
last durable checkpoint and never duplicates memory.

### 5. Persistent completion and alpha cleanup

Every alpha import gets a fresh, isolated `agent_memory_v1` DB. Completion
persists:

- source repository and pinned commit;
- files considered / imported / skipped;
- rows written by memory object and extraction category;
- verification status and golden-query answers;
- **Ask this memory** as the primary next action;
- **Delete this test memory** and **Import again** as explicit alpha actions.

Deletion reuses `SK-HDC-016`'s tenant-scoped database deletion and typed-name
confirmation. It deletes only the derived DB; GitHub and the source repository
are untouched. “Import again” starts from a clean DB rather than mixing
experiments, making founder review and user recovery unambiguous.

## Public-alpha acceptance journey

The alpha label stays until the founder explicitly approves promotion after
manually walking all of these against the production-shaped surface:

1. Signed-out public repo: useful preflight appears before sign-in; sign-in
   returns and completes without GitHub authorization or repeated input.
2. Signed-out private repo: sign-in → selected-repo, read-only GitHub App
   consent → automatic resume and completion.
3. Authorization denied: draft survives; retry and public-repo alternatives
   work without restarting.
4. Refresh or connection loss during every phase: counters and work resume
   without duplicate rows.
5. Repo with no eligible structure: useful empty state, reasons shown, no
   memory DB retained.
6. Completion counts reconcile, every golden query has a visible result, and
   reload preserves the proof.
7. Founder deletes the test memory after each scenario; the DB disappears,
   its keys stop working, and the source repo remains unchanged.

The matching P2 persona E2E journey covers the same states. Manual founder use
is an additional product-quality gate, not a substitute for E2E.

## Measurement

- click → useful preflight latency;
- preflight → sign-in completion;
- public imports that avoid GitHub authorization;
- provider denial/recovery rate;
- import completion and retry-recovery rate;
- count mismatches or duplicate writes (target zero);
- completion → first successful memory query;
- alpha cleanup success.

This advances the `GLOBAL-025` onboarding and UX pillars. It does not add a
pack-specific engine surface.

## Progress — slice 1, runner core (2026-08-10)

Founder direct-ordered the shared runner core ahead of the rest of the
journey, because EK-04 boxes 2–4 and EK-05 boxes 1–3 all listed it as an
unmet prereq that no loop owned. Prereq note: **D-04 has not run**, so the
runner is code-complete and unit-tested but has not yet imported a real repo
in production — that is what the acceptance journey below still gates.

**Shipped.**

- `apps/api/src/pack-runner/types.ts` — the pack adapter contract. A pack
  supplies `parseSource` / `acquire` / `classify` / `extract` /
  `goldenQueries`; the runner owns everything else. Deliberately free of
  repo vocabulary (`SourceItem.id`, `SourceDescriptor.pin`) so EK-04's
  interview adapter is instance #2 with no runner change — asserted, not
  asserted-in-prose, by the fake non-repository pack in `runner.test.ts`.
- `apps/api/src/pack-runner/runner.ts` — the five-phase state machine with
  a durable checkpoint per phase, the per-row `saveCursor` that makes retry
  non-duplicating on append-only `facts`, planned-vs-read-back
  reconciliation, and the runner-owned credential-value guard that no pack
  can opt out of (`SK-PIVOT-018`).
- `apps/api/src/pack-runner/draft-store.ts` + `migrations/0029_pack_imports.sql`
  — the opaque draft in D1. `tenant_id` is NULL until an authenticated
  advance atomically claims it: that is the sign-in resume seam.
- `apps/api/src/pack-runner/github-source.ts` — anonymous public preflight
  via two REST calls (pin the default-branch commit) plus the codeload
  `tar.gz` archive, expanded with the runtime's `DecompressionStream` and a
  ~50-line tar reader (no dependency, `GLOBAL-013`).
- `apps/api/src/pack-runner/packs/repo-ops.ts` — instance #1. The
  open-question and blocked-queue extractors are **imported** from
  `@nlqdb/docs-memory` (D-01/D-02a), not re-implemented; this adds decision
  records and cross-references. Row vocabulary matches the `SK-QUAL-023`
  repo-ops corpus exactly, so D-03's golden queries still answer.
- Routes: `POST /v1/packs/imports` (public preflight, `Idempotency-Key`),
  `GET /v1/packs/imports/:id`, `POST …/advance`, `POST …/retry`,
  `DELETE …/:id` (reuses the `SK-HDC-016` deletion path verbatim).
  Provisioning reuses the `SK-HDC-020` preset create — no second path.
- Spans: `nlqdb.pack.source.fetch`, `nlqdb.pack.source.archive`,
  `nlqdb.pack.import.{create,advance,retry,delete}` (`GLOBAL-014`).

**Deliberately not in this slice** (so the boxes below stay honest): the
`/agents` page + CTA, the sign-in `return_to` handoff UI, the private-repo
GitHub App flow, and the P2 persona E2E journey.

`GLOBAL-003` surface gap, tracked here: `/v1/packs/imports*` is HTTP-only —
no SDK, CLI, MCP tool or `<nlq-data>` support. That is deliberate and may
stay so: the import journey is a product surface, like `/v1/chat/messages`
and `/v1/grants`, not a data capability an agent calls. Promote it only if a
real caller asks.

**Hardened in review (2026-08-10).** One advance of a draft runs at a time,
via a compare-and-swap on the draft's `updated_at` (`DraftStore.lease`,
`409 import_busy`): without it two simultaneous advances each provisioned a
Neon schema — one orphaned beyond the reach of the `SK-HDC-016` cleanup — and
each replayed the same rows into a draft that already had a DB. `saveCursor`
only makes a *sequential* retry non-duplicating, and KV idempotency cannot
serialise concurrent callers (`SK-IDEMP-005`). `save` no longer writes
`tenant_id` (claim is its only writer), the credential guard now inspects the
whole payload rather than the fields today's packs happen to use, the
preflight throttle covers signed-in callers too, and `owner`/`repo` reject
`.`/`..` segments that `fetch` would normalise into a different GitHub path.

**Three findings worth carrying forward.**

1. `entity_facts` **edges cannot be written** through the public surface:
   `nlqdb_remember` has `fact` / `episode` / `entity` verbs and no edge
   verb. Slice 1 therefore carries cross-references as `reference` facts
   tagged with both endpoints — the same shape the eval corpus uses — and
   the edge rows themselves need an engine-track decision, not a pack.
2. The per-row memory write bypasses the 60/min `/v1/ask` limiter (an
   import of 200 rows cannot pass it); the import is rate-limited once per
   advance at the route instead. Recorded here because it is a deliberate
   granularity choice, not an oversight.
3. The anonymous half of `POST /v1/packs/imports` scopes its
   `Idempotency-Key` and its throttle by originating IP, while
   [`SK-IDEMP-010`](../../../idempotency/FEATURE.md) says the anonymous dedupe
   identity is the device-token hash. The preflight deliberately requires no
   anon principal (`GLOBAL-007`: value before any identity), so there is no
   device token to key on. Flagged rather than resolved: either the preflight
   adopts the anon principal or `SK-IDEMP-010` gains a no-principal arm — a
   founder call, not a review fix.

## Sources checked

- GitHub, **Rate limits for the REST API** — public unauthenticated data is
  allowed at 60 requests/hour per IP:
  <https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>
- GitHub, **REST API endpoints for Git trees** — recursive tree limits:
  <https://docs.github.com/en/rest/git/trees?apiVersion=2026-03-10>
- GitHub, **Downloading source code archives** — stable public archive URLs:
  <https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives>
- GitHub, **Differences between GitHub Apps and OAuth apps** — GitHub Apps are
  preferred for granular permissions, selected repositories and short-lived
  tokens:
  <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps>

## Done when

- [x] The shared runner—not repo-specific page logic—owns the journey state.
      (2026-08-10 — `apps/api/src/pack-runner/**`. Proven rather than
      asserted: `runner.test.ts` drives the full journey with a fake
      **interview** pack whose source is not a repository, so a repo-shaped
      assumption in the runner breaks the build.)
- [ ] Public preflight, auth return, private GitHub App return and interrupted
      execution all resume from one opaque import URL.
      *(Partial 2026-08-10: the opaque draft, the public preflight, the
      atomic sign-in claim and interrupted-execution resume all work
      server-side and are unit-tested. Unbuilt: the `return_to` handoff UI
      and the private-repo GitHub App flow.)*
- [ ] Progress and completion counts are real and reconcile.
      *(Partial 2026-08-10: real counters per phase and a planned-vs-read-back
      reconcile with an honest mismatch list, unit-tested. Not yet observed
      against a live memory DB — D-04 has not run.)*
- [ ] The public alpha ships with reset/delete and the P2 E2E journey.
- [ ] The founder completes and cleans up every acceptance scenario.
- [ ] The founder explicitly approves removing the alpha label.
