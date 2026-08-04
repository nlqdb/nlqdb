# D-08 — Goal pack #1 as a one-click repo-memory import

**Status:** planned — public alpha until explicit founder promotion
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

- [ ] The shared runner—not repo-specific page logic—owns the journey state.
- [ ] Public preflight, auth return, private GitHub App return and interrupted
      execution all resume from one opaque import URL.
- [ ] Progress and completion counts are real and reconcile.
- [ ] The public alpha ships with reset/delete and the P2 E2E journey.
- [ ] The founder completes and cleans up every acceptance scenario.
- [ ] The founder explicitly approves removing the alpha label.
