// `/blog/<slug>` source of truth. One object per post; `blog/[slug].astro`,
// `blog/index.astro`, `sitemap.xml.ts`, and `llms.txt.ts` all read from
// this file — publishing a post is a one-file edit (same pattern as
// `data/solve.ts` / `data/competitors.ts`).
//
// Posts are the canonical copies of `docs/research/distribution-queue.md`
// drafts, published autonomously by the /daily loop (SK-BLOG-001 — no
// founder review gate). Community-venue variants (dev.to, Reddit, HN)
// point back here as the canonical URL.
//
// Body model: typed blocks, not markdown files (SK-BLOG-002). Paragraph /
// list text carries the inline-markdown subset `lib/inline-md.ts` renders
// (`code`, **strong**, *em*, [links](…)); note its documented limit —
// strong/em/links must not wrap a code span.

export type BlogBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "code"; lang: string; code: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

export type BlogPost = {
  // URL-safe lower-kebab; appears in the canonical URL /blog/<slug>/.
  slug: string;
  // <h1> and the BlogPosting JSON-LD headline. Written like the queue
  // draft titles — a concrete engineering claim, not marketing copy.
  title: string;
  // Direct-answer capsule (≤200 chars) — the meta description, the index
  // one-liner, and the llms.txt line.
  description: string;
  // Publication date, ISO yyyy-mm-dd (the day the post went live on
  // /blog, not the day the draft entered the queue).
  date: string;
  // The /vs or /solve page this post anchors, if any — rendered as a
  // "read the full guide" link under the CTA.
  anchor?: { label: string; path: string };
  body: BlogBlock[];
};

// Newest first — the index page and llms.txt render in array order.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "green-checkmark-has-a-half-life",
    title: "A green checkmark has a half-life.",
    description:
      "When an expensive test suite can't run on every push, passing stops being a state and becomes an event. Score each suite pass × freshness with a linear decay so the dashboard number rots until someone re-runs it.",
    date: "2026-07-12",
    body: [
      {
        kind: "p",
        text: "Our end-to-end suites are manual-dispatch-only, on purpose. Every run burns free-tier quota — a fresh Neon branch, a Workers preview deploy, LLM tokens — so running e2e is a deliberate operator action. We explicitly rejected a cron: a suite that fails at 3 a.m. has no triggering author to catch the red, and the bill still arrives.",
      },
      {
        kind: "p",
        text: 'That trade-off is defensible. The consequence we hadn\'t written down is not: **once e2e stops running on every push, "passing" stops being a state and becomes an event.**',
      },
      { kind: "h2", text: "The checkmark that stopped meaning anything" },
      {
        kind: "p",
        text: "The API deploys daily. A suite that went green on Tuesday asserts nothing about Friday's build — the thing it certified has changed underneath it three times. But the dashboard still shows the same reassuring checkmark from Tuesday, and nobody re-reads a green row. The signal decayed; the pixel didn't.",
      },
      {
        kind: "p",
        text: "A cron would paper over this by re-running constantly, but that just trades a stale-signal problem for a cost-and-nobody's-watching problem. We wanted the *metric itself* to admit when it had gone stale.",
      },
      { kind: "h2", text: "Score pass × freshness" },
      {
        kind: "p",
        text: "So each suite scores `pass × freshness`, where `freshness` decays linearly from 1 to 0 over a fixed window. A suite that passed today scores ~1.0; the same green run a week later scores ~0. The dashboard number rots on its own until an operator re-dispatches — the score replaces the cron, instead of the cron replacing judgement.",
      },
      {
        kind: "code",
        lang: "ts",
        code: "// latest completed run only; a red run scores 0 regardless of age.\nconst freshness = Math.max(0, 1 - daysSinceLastSuccess / WINDOW_DAYS);\nconst score = passed ? freshness : 0;",
      },
      { kind: "h2", text: "Three notes that made the number honest" },
      {
        kind: "ol",
        items: [
          "The window is a compromise, and the metric should say so. The honest window is your deploy cadence — a suite is stale the moment the thing it certifies changes underneath it. But every dispatch costs quota, so our 7-day window against daily deploys makes the score an **upper bound on confidence**, not a guarantee. Name that in the doc next to the number.",
          "Score only the latest completed run, and a red run is 0 regardless of freshness. Averaging history lets an old green subsidize a current red — exactly the reassurance you're trying to remove.",
          "Print the last-success date in the same cell as the score. `0.67` is a number nobody can audit; `0.67 (last green Jul 5)` tells the reader why, and whether to re-run.",
        ],
      },
      {
        kind: "p",
        text: "This is a measurement-hygiene pattern, not a product feature: it's for anyone whose test suites are too expensive to run on every push. If your CI is cheap enough to gate every merge, you don't need it — your freshness is always ~1. The moment it isn't, a bare checkmark is lying to you by omission, and a decaying score is the cheapest honesty you can buy.",
      },
    ],
  },
  {
    slug: "ephemeral-staging-persistent-registry",
    title: "We rebuilt staging's database every run. The registry remembered everything.",
    description:
      "An environment is only as ephemeral as the most persistent store that references it. Enumerate every store that outlives the rebuild and reset it at spin-up — teardown can't be the invariant.",
    date: "2026-07-12",
    body: [
      {
        kind: "p",
        text: "Our E2E staging is ephemeral by the book: every run creates a fresh Postgres branch, deploys a per-run preview of the API worker against it, and deletes the branch when the run ends. A crashed run leaves a stale branch? The next run deletes and recreates it by name. Clean slate, every time — we thought.",
      },
      { kind: "h2", text: "The store that never went away" },
      {
        kind: "p",
        text: "The slate wasn't the only state. The preview worker binds its *control plane* — the registry that maps \"database\" rows to schemas, plus sessions and chat history — from the same configuration production uses, because per-run previews inherit the deployed config by default. So while the data plane (the Postgres branch) was destroyed at both ends of every run, the registry rows the suite created each run outlived it, quietly accreting in production's control store.",
      },
      {
        kind: "p",
        text: 'Rows that reference destroyed schemas are worse than junk — they\'re plausible. Three symptoms, none of which said "stale registry": the fixture account\'s sidebar filled with same-name ghosts, so tests that pin a database by name sometimes landed on a schema that no longer existed and failed with "couldn\'t reach the database" — which reads exactly like an infra flake. The cleanup test that deletes leftovers through the UI grew a backlog it could never finish: ~27 rows, one typed-confirm modal at a time, against a 300-second budget. And its name-scoped walk never matched leftovers with *other* names at all — one orphan survived every run for weeks. The suite reported "app red" for state no real user could ever reach.',
      },
      { kind: "h2", text: "Rule 1: enumerate what outlives the rebuild" },
      {
        kind: "p",
        text: 'An environment is only as ephemeral as the most persistent store that references it. "Ephemeral staging" usually means *one* store is per-run — the big obvious database — while everything that points at it (registry, sessions, queues, caches, object storage) lives on a longer clock. The fix is an inventory, not a slogan: list every store the environment touches, mark each one\'s lifetime, and for every store that outlives the rebuild, reset the slice that references the rebuilt one.',
      },
      {
        kind: "p",
        text: "And do the reset at *spin-up*, not teardown. A crashed run skips teardown by definition — teardown-time cleanup guarantees exactly nothing about the state the next run starts from. Spin-up is the one step every run passes through:",
      },
      {
        kind: "code",
        lang: "yaml",
        code: "# Staging spin-up — right after the data plane is recreated.\n# The control plane outlives the branch, so purge the slice of it\n# that points at the branch we just destroyed. Idempotent; runs\n# even when the previous run crashed before its own cleanup.\n- name: Purge fixture registry rows\n  run: |\n    db exec \"DELETE FROM chat_messages WHERE user = '$FIXTURE_USER';\n             DELETE FROM registry WHERE tenant = '$FIXTURE_USER';\"",
      },
      { kind: "h2", text: "Rule 2: in-band cleanup verifies the feature, not the invariant" },
      {
        kind: "p",
        text: "We *had* cleanup — a test that deletes leftover databases through the real UI. Keep that test: it verifies the delete feature works. But it cannot be the invariant that staging starts clean, because it runs inside the thing it's supposed to guarantee — it inherits the suite's budget, its flakes, and its crashes. The invariant needs an out-of-band guarantee that runs before the suite, unconditionally. After we split the two, the UI cleanup test went from an unbounded backlog walk that timed out to a constant-size walk that passed for the first time on record — and the suite's wall time dropped 45%.",
      },
      {
        kind: "p",
        text: "The purge also sharpened every failure that remained: with the ghost class gone, the surviving red pointed at a real application bug instead of registry debris. Deleting confounders is diagnosis. (This is a build note from [nlqdb](https://nlqdb.com), the database you query in plain English. Honest split: a CI/test-infra lesson from our E2E harness, not a product feature.)",
      },
    ],
  },
  {
    slug: "ownership-transfer-outlives-least-privilege",
    title: "Ownership transfer was a one-row UPDATE. Then we added least-privilege.",
    description:
      "Hardening queries to per-tenant roles and RLS quietly broke our ownership transfer: it retargeted one authorization store out of four. Transfer must move them all — idempotently, in one batch.",
    date: "2026-07-12",
    body: [
      {
        kind: "p",
        text: 'Multi-tenant Postgres, one schema per tenant database. On day one, every query ran as the shared owner role, so "transfer this database to the user who just signed in" was honestly a one-row registry UPDATE — flip `tenant_id`, done. We wrote that down as a design decision, and it was the right one at the time.',
      },
      { kind: "h2", text: "Least-privilege arrived; the transfer path didn't get the memo" },
      {
        kind: "p",
        text: "Months later we hardened the query path. Every query now runs `SET LOCAL ROLE tenant_<hash>` against per-tenant grants, and a row-level-security policy whose `USING` clause bakes the tenant id in as a literal. Four places now store who owns this database: the role itself, its grants, the runner's role membership, and the policy literal. The transfer path still updated exactly one — the registry row.",
      },
      {
        kind: "p",
        text: 'So transfers kept *working* in the registry — the sidebar showed the database under its new owner — while every transferred database went permanently unqueryable: the role the session now switches to was never created, never granted `USAGE`, never made a `WITH SET` member, and the RLS literal still named the old tenant. Three authorization layers said "old owner"; one row said "new owner"; the row lost.',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- The transfer that \"worked\" — one of four authorization stores:\nUPDATE databases SET tenant_id = :new_tenant WHERE id = :db_id;\n\n-- What least-privilege actually requires, idempotently, in one batch:\nDO $$ BEGIN\n  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tenant_9047fe') THEN\n    CREATE ROLE tenant_9047fe NOLOGIN;             -- 1. the role exists\n  END IF;\nEND $$;\nGRANT USAGE ON SCHEMA app TO tenant_9047fe;        -- 2. the grants\nGRANT tenant_9047fe TO query_runner WITH SET TRUE; -- 3. the membership\nALTER POLICY tenant_isolation ON app.facts         -- 4. the RLS literal\n  USING (tenant_id = 'tenant-9047fe');",
      },
      { kind: "h2", text: "The error wore a cold-start costume" },
      {
        kind: "p",
        text: 'Worse, the failure was invisible. `SET ROLE` to a missing role fails with a deterministic SQLSTATE — `22023` (invalid parameter value: the role does not exist) or `42501` (insufficient privilege) — and our generic error branch re-labelled both as "couldn\'t reach the database," the same message a serverless cold start produces. No code was logged anywhere. For nine end-to-end runs we diagnosed retry timing on an error that was never transient.',
      },
      {
        kind: "p",
        text: "The tell that finally broke the costume: *creates* succeeded while the transferred database failed in the same second — for minutes on end — with the correct SQL planned every time. Cold starts don't select their victims by ownership history. Deterministic failures wearing a transient error's label do.",
      },
      { kind: "h2", text: "Two general fixes" },
      {
        kind: "ol",
        items: [
          "**An ownership transfer must retarget every place authorization state lives** — role existence, grants, role membership, policy literals — idempotently, in one batch. The day you turn least-privilege on, grep for every writer of your tenant column: each one is a transfer path that just silently broke.",
          "**A catch-all error branch must log the code it swallows.** Re-labelling an error without recording the original SQLSTATE means you will re-diagnose the same bug from scratch, behind a message that actively points you at the wrong cause.",
        ],
      },
      {
        kind: "p",
        text: "The general shape: an invariant added in one subsystem (queries run least-privileged) creates an obligation in another (transfer must move authorization state), and nothing but a human's memory connects the two. When you add a security layer, walk every path that *writes* the identity it keys on — not just the paths that read it.",
      },
      {
        kind: "p",
        text: "(This is a build note from [nlqdb](https://nlqdb.com), the database you query in plain English. Honest split: this is a Postgres multi-tenancy lesson from our adoption path, not a product feature.)",
      },
    ],
  },
  {
    slug: "most-active-user-is-your-test-suite",
    title: "Your most active user is your test suite.",
    description:
      "Pre-launch, synthetic traffic IS your traffic: e2e walkers register users and run real queries, so every dashboard quietly measures your robots. Three places it bit us, three fixes.",
    date: "2026-07-11",
    body: [
      {
        kind: "p",
        text: "Before launch, your end-to-end suite is often the only thing exercising production. Ours registers fixture users, creates databases, and asks real natural-language queries through the exact pipeline a stranger would hit — which is the point of an e2e suite, and also the problem: every dashboard we built quietly measured our robots. Here are the three places it bit us, and the fix for each.",
      },
      { kind: "h2", text: "1. Your web analytics count headless browsers as visits" },
      {
        kind: "p",
        text: 'Our weekly funnel said 120 visits. Real-browser visits were about 41. The rest were our own walkers: headless Chromium lands in RUM analytics with `userAgentBrowser: "Unknown"` — 76 of the 120 — plus one that identified as headless outright. The fix is a pinned client-class cut: count named browsers (Chrome, Mobile Safari, Edge…) as the filtered number, and report *both* numbers side by side. Raw tells you the instrument is alive; filtered tells you whether humans showed up. Reporting only one of them is how you lie to yourself in either direction.',
      },
      { kind: "h2", text: "2. Your product KPIs saturate on fixture accounts" },
      {
        kind: "p",
        text: "Our headline onboarding KPI — the share of a new account's first ten queries that succeed — dropped 8 points in one night. No deploy, no incident. A *failing e2e run* had burned its asks against the same saturating counters real users increment; the suite's fixture account looked like our worst-onboarded user, because it was.",
      },
      {
        kind: "p",
        text: "The tempting fix is to skip the counters when the caller is a test account — and it's wrong. The write path is the thing under test; fork it for fixtures and your suite stops exercising the pipeline you ship. Filter at *read* time instead: keep an explicit founder/test identity list and join it against every user-scoped metric when you pull the number. Writes stay honest, reads stay clean, and the filter is one place to audit instead of a flag threaded through every emit site.",
      },
      { kind: "h2", text: "3. The hardest one: accepting “not yet measurable”" },
      {
        kind: "p",
        text: "Once the joins were in place, our first-ten-queries KPI read: stranger sample size zero, not yet measurable. That's a worse-feeling number than the unfiltered 5/22 it replaced — and a strictly better one. A KPI computed over founder and fixture traffic isn't a pessimistic estimate of the real number; it's a number about a different population wearing the KPI's name. Shipping it to a scorecard anchors decisions to noise. An honest “N=0” at least tells you what the actual bottleneck is: distribution, not product.",
      },
      { kind: "h2", text: "The rule of thumb" },
      {
        kind: "p",
        text: "A metric that doesn't name its population is measuring your robots. Every user-scoped number on a pre-launch dashboard should say which of three populations it covers — everyone, humans-only, or strangers-only — and the cut that produces it should be pinned in one greppable place (a UA class list, an identity list) rather than re-derived per query. Synthetic traffic through the production pipeline is a feature; synthetic traffic in your KPIs is a bug, and the boundary between them is attribution at read time.",
      },
    ],
  },
  {
    slug: "five-fallback-models-one-provider",
    title: "Your five fallback models are one point of failure.",
    description:
      "A model-diverse fallback list on one gateway saturates as a unit — five models, one rack. Make the fallback unit a lane (base URL, key, candidates), not a longer list on the same pool.",
    date: "2026-07-11",
    body: [
      {
        kind: "p",
        text: "Our agentic CI suite drives a real browser with an LLM. The driver model comes from an ordered five-model fallback list — health-probed before each run with real tool-call probes, re-ranked by measured agent competence. Textbook redundancy. It still failed 13 dispatches in a row.",
      },
      { kind: "h2", text: "Model-diverse, provider-identical" },
      {
        kind: "p",
        text: "The list was diverse in the dimension we could see — five different model families, five different weights — and identical in the dimension that failed: every slug resolved to the same gateway's free pool. That pool saturates as a unit. When model #1 came back `429`, models #2 through #5 were rate-limited too, at 04:37 UTC and at 22:14 alike, because the limit lives on the shared pool, not on any model. Five models on one provider are five servers in one rack.",
      },
      {
        kind: "p",
        text: "The probes made it worse, not better. A three-probe health gate picked whichever model answered its probes that minute — and then the pick starved 216 seconds into the run, because passing three probes measures a moment of pool weather, not a claim on future capacity. A flapping pool passes probes all day.",
      },
      { kind: "h2", text: "The tell in the traces" },
      {
        kind: "p",
        text: 'What finally broke the diagnosis open was a latency split in the Playwright traces: the product under test answered its API call in 4 seconds with a 200 — while three tests burned their entire 240-second budget waiting for the *driver* to produce the next click. The app was green; the thing testing the app was starving; the suite reported "product red." If your E2E harness and your product share a failure domain, a harness outage is indistinguishable from a product regression until you split them.',
      },
      { kind: "h2", text: "Redundancy has to cross the failure-domain boundary" },
      {
        kind: "p",
        text: "The fix is a *lane*, not a longer list. A lane is the real unit of failure: base URL + API key + candidate models. Fall back between lanes only when the whole primary lane fails its probes — and make the first fallback candidate the *same weights hosted by a different provider*, which keeps agent competence constant while moving to an independent pool:",
      },
      {
        kind: "code",
        lang: "ts",
        code: '// The fallback unit is the lane, not the model. Walking candidates\n// inside one lane retries the same saturated pool with a new name.\ntype Lane = { baseUrl: string; apiKey: string; candidates: string[] };\n\nconst LANES: Lane[] = [\n  // Primary: an independent pool. Same weights as the old list’s best\n  // performer, hosted elsewhere — competence constant, failure domain new.\n  { baseUrl: NIM_URL, apiKey: NIM_KEY, candidates: ["openai/gpt-oss-120b"] },\n  // Fallback: the gateway’s free pool — five candidates, ONE domain.\n  { baseUrl: GW_URL, apiKey: GW_KEY, candidates: FREE_SLUGS },\n];\n\nfor (const lane of LANES) {\n  const model = await probeLane(lane); // 3 real tool-call probes\n  if (model) return { ...lane, model };\n  // Whole lane failed — only now is trying elsewhere informative.\n}',
      },
      {
        kind: "p",
        text: "One more boundary matters: budgets. The fallback lane must not raid the quota the application under test runs on — if the rescue driver and the product share a pool, the rescue *causes* the next outage. Keep the driver's spend and the product's spend on separate keys, and treat \"the driver ran out\" as a harness failure, never a product failure.",
      },
      {
        kind: "p",
        text: "On the first dispatch with the swapped lanes, the test that had starved at 216 seconds passed in 14.9 — same suite, same app, same weights. Nothing about the product changed; only the failure domain did. (This is a build note from [nlqdb](https://nlqdb.com), the database you query in plain English. Honest split: a CI/infra lesson from our E2E harness, not a product feature.)",
      },
    ],
  },
  {
    slug: "decided-questions-rot-in-your-decision-log",
    title: "An \"open question\" that's already decided is worse than one that's still open.",
    description:
      "Decision logs rot at the seam between open and answered: a decided-but-unmarked bullet makes readers re-litigate closed calls. Make resolved a greppable state and count unmarked bullets as debt.",
    date: "2026-07-11",
    body: [
      {
        kind: "p",
        text: "Every long-lived codebase grows a decision log — ADRs, a `DECISIONS.md`, per-feature records — and every one of those grows an *Open questions* section. The failure mode isn't the open questions. It's the entries that were quietly *answered* — in a PR, a standup, a founder's one-line reply — and never re-labelled. A bullet that reads \"we should probably cap the queue at 7,000 ops/day\" is a decision wearing an open question's clothes.",
      },
      { kind: "h2", text: "What a decided-but-unmarked bullet does to a reader" },
      {
        kind: "p",
        text: 'A reader who hits that bullet does one of two bad things. Either they treat the settled call as unsettled and re-litigate it — burning a design discussion on a question someone already closed — or they build on top of a "maybe" that was actually a "yes," and their design inherits a hedge that no longer exists. Both cost more than an honestly open question would, because the log *looks* authoritative while pointing nowhere. A vague decision documented is worse than none.',
      },
      { kind: "h2", text: "Two moves fix it" },
      {
        kind: "p",
        text: "First, make *resolved* a first-class, greppable state. A decided bullet keeps its line but gains a marker word — `Resolved`, `Decided:`, `Parked`, or a strikethrough — plus a pointer to the decision's canonical home. The questions list is where a question's lifecycle is visible; it is never where the decision's body lives. When you answer an open question, the *same commit* moves the body to the canonical record and leaves only the marked pointer behind — never a second copy that can drift.",
      },
      {
        kind: "p",
        text: "Second, count the unmarked ones as debt. If *resolved* is greppable, so is *unresolved* — and a number you can compute is a number you can drive to zero:",
      },
      {
        kind: "code",
        lang: "bash",
        code: "# Ambiguity debt: open-question bullets with no resolution marker.\n# -h suppresses the filename prefix grep -A puts on context lines —\n# without it the bullet match never fires and the count is always 0.\n# Case-INSENSITIVE on the marker set — a case-sensitive grep counts\n# \"resolved\" and \"Resolved\" differently and the number drifts.\ngrep -hA9999 '^## Open questions' docs/features/*/FEATURE.md \\\n  | grep '^\\s*- ' \\\n  | grep -vciE 'resolved|decided:|parked|deferred|~~'",
      },
      {
        kind: "p",
        text: 'The case-insensitivity is not a nitpick — it\'s the difference between a metric and a mood. We track this count as a scorecard row, and the first version drifted for exactly that reason: two agents marked resolutions with different capitalization, the grep saw only one, and the "debt" number moved without any question changing state. Pin the counting method next to the number it produces.',
      },
      { kind: "h2", text: "Why a count, and not a cleanup day" },
      {
        kind: "p",
        text: "A one-off sweep fixes today's rot and leaves the seam that produced it. The count makes the seam visible continuously: every answered-but-unmarked bullet is +1 debt that someone will notice, and driving one bullet to a marked resolution is a small, complete, verifiable unit of work — research the answer, write it in the canonical home, mark the pointer. A question only a human with prod access or a checkbook can answer moves to a separate blocked-on-human list and off the count, so the number only tracks debt an engineer can actually retire.",
      },
      {
        kind: "p",
        text: "(This is a build note from [nlqdb](https://nlqdb.com), the database you query in plain English. Our decision log is agent-operated, which makes the rot mechanical instead of cultural — but the fix is the same one a human team needs. Honest split: a decision-hygiene lesson, not a product feature.)",
      },
    ],
  },
  {
    slug: "emit-metrics-where-the-distinction-is-certain",
    title: "Your metric is only as honest as the layer you emit it from.",
    description:
      "A destructive-op retry rate emitted at the HTTP route can go negative — the route can't tell reads from writes. Emit metrics at the lowest layer where the distinction is certain.",
    date: "2026-07-11",
    body: [
      {
        kind: "p",
        text: "We wanted one number: the destructive-op retry rate — the share of write previews a user abandons instead of confirming. Our pipeline renders every destructive statement as a diff first; the user re-sends with a confirm flag to commit. So the rate is `1 - committed / preview_rendered`, and it takes exactly two counter events to compute. The only real design decision is where those two events get emitted — and the obvious answer is wrong.",
      },
      { kind: "h2", text: "The route doesn't know what it's confirming" },
      {
        kind: "p",
        text: "The obvious emit site is the HTTP route. It already has everything an event wants: the principal, the surface, the request, the response status. Emit `preview_rendered` when the response asks for confirmation, `committed` when a request carrying `confirm: true` returns 200. Done — except the route does not actually know whether the statement was a write. That fact is decided two layers down, where the generated SQL is inspected and the preview-vs-commit branch is taken. The route sees a flag and a status code.",
      },
      {
        kind: "p",
        text: "Here is the failure that makes it concrete: a client sends a read with a stray `confirm: true` — a retried request, an over-eager SDK default, a copy-pasted call. The read succeeds, the route emits `committed`, and there is no matching `preview_rendered` because reads never preview. The numerator now exceeds the denominator, and your retry rate goes negative — a number that cannot exist. Nothing errored. Every layer behaved correctly. The metric was simply emitted above the layer where its defining distinction is known.",
      },
      {
        kind: "code",
        lang: "ts",
        code: '// Route layer — the tempting emit site. It has the principal, the\n// surface, the status. It does NOT know whether the plan was a write:\n// emit "committed" on any confirm:true 200 and a stray-confirm read\n// inflates the numerator. The rate goes negative.\n\n// Orchestrator — both facts are certain on exactly this boundary.\nif (!req.confirm && isWriteVerb(planSql)) {\n  // A write plan rendered as a diff, nothing executed: the denominator.\n  emit({ name: "feature.destructive.preview_rendered", surface: req.surface });\n  return { requires_confirm: true, diff };\n}\n// ...execution happens only past this point...\nif (req.confirm && isWriteVerb(planSql)) {\n  // Exec success on an approved diff: the numerator.\n  emit({ name: "feature.destructive.committed", surface: req.surface });\n}',
      },
      { kind: "h2", text: "Thread facts down, don't pull decisions up" },
      {
        kind: "p",
        text: "The fix is not teaching the route to re-detect writes — that duplicates the write-detection logic in a second place, and the two copies will drift. The fix is moving the emission down to the layer where `isWriteVerb(sql)` and the preview-vs-commit branch are already decided. There, both events fire on exactly the boundary they measure, and a stray-confirm read emits nothing at all.",
      },
      {
        kind: "p",
        text: "Moving down costs you one thing: the lower layer didn't know the surface the request came from — web app, CLI, MCP — and the events are only useful sliced by surface. So thread that one field down through the request. Passing one known fact down is cheap and drift-free; hoisting a whole decision up is neither. And when a caller doesn't thread the field — an internal path with no surface — skip the emit rather than fabricating a value. A gap in the data is honest; a guessed label is not.",
      },
      { kind: "h2", text: "The rule" },
      {
        kind: "p",
        text: "A metric's emit point is the lowest layer where the distinction it encodes is certain. Above that layer you are guessing, and a guessed metric is worse than no metric, because it looks precise while being structurally wrong — negative rates, inflated numerators, denominators that undercount. The same reasoning fixes the dedup key: a volume event like this one keys on the request, not on a per-principal-per-day bucket, because collapsing repeated previews from one user would erase exactly the retries the metric exists to count. Decide what distinction the number encodes, find the lowest layer where that distinction is a fact, and emit there.",
      },
      {
        kind: "p",
        text: "(This is a build note from [nlqdb](https://nlqdb.com), the database you query in plain English — where destructive statements render as a diff you approve before anything runs. Honest split: this is an instrumentation-design lesson, not a product feature.)",
      },
    ],
  },
  {
    slug: "rotate-encryption-key-without-a-version-column",
    title: "You need to rotate an encryption key. You don't need a key-version column.",
    description:
      "Rotating a key-encryption key feels like it needs a key_version column. It doesn't — the ciphertext already describes itself, so put the version in the blob prefix and rotate with zero migration.",
    date: "2026-07-10",
    body: [
      {
        kind: "p",
        text: "We seal secrets at rest — a customer's database DSN, a stored API key — under a key-encryption key (KEK). Sooner or later you have to rotate that KEK: it's been in an env var too long, it might have leaked, or a policy just says every key expires. And the moment you plan the rotation, a reflex kicks in: add a `key_version` column so you know which key sealed which row. Skip it. That column is a second source of truth for something the ciphertext already has to tell you, and the two will drift.",
      },
      { kind: "h2", text: "The ciphertext is already self-describing" },
      {
        kind: "p",
        text: "You cannot decrypt AES-GCM without the IV, so the IV was never a secret and it already lives inside the stored blob — every sealed value is a self-describing string, not opaque bytes. A key version is exactly the same kind of fact: metadata you need in hand before you can decrypt. So it belongs in the same place the IV does — the blob — not in a sibling column that every write path has to keep in sync. One token of prefix carries it:",
      },
      {
        kind: "code",
        lang: "ts",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: this is sample source shown to the reader — the ${…} are real template literals in the example, not a placeholder bug.
        code: '// The sealed blob already carries its IV. Give it a version tag too.\n//   nbe2.<v>.<iv>.<ciphertext>\n// Bumping the KEK is a one-token change: v1 -> v2. No schema migration,\n// no key_version column, no ALTER TABLE, no backfill job on write.\nfunction seal(plaintext: string, kek: Kek): string {\n  const iv = randomIv();\n  const ct = aesGcmSeal(plaintext, kek.material, iv);\n  return `nbe2.${kek.version}.${b64(iv)}.${b64(ct)}`; // version IS the tag\n}\n\nfunction open(blob: string, keyring: Keyring): string {\n  const [, version, iv, ct] = blob.split(".");\n  const kek = keyring.byVersion(version); // pick the key the blob names\n  return aesGcmOpen(fromB64(ct), kek.material, fromB64(iv));\n}',
      },
      { kind: "h2", text: "What the prefix buys you that a column doesn't" },
      {
        kind: "p",
        text: "Rotation becomes a sequence of cheap, interruptible steps instead of a migration. You add the new key to the keyring alongside the old one — a two-key overlap window. Reads pick the right key by the tag the blob carries, so nothing breaks the instant you flip. Writes always seal under the newest version, so every row that gets touched migrates itself. Then you do one sweep for the cold rows that nobody wrote, and drop the old key when no blob still carries its version.",
      },
      {
        kind: "p",
        text: "The part people reach for the column to solve — \"find the rows still on the old key\" — the prefix already solves, and solves better: stale rows are filterable by their tag without decrypting a single one. A `WHERE blob LIKE 'nbe1.%'` finds every row that needs re-wrapping straight off the index. The `key_version` column only earns its keep if that sweep has to find stale rows blind — and it never does, because the tag is right there in the value.",
      },
      { kind: "h2", text: "The one nuance: derived keys vs. stored DEKs" },
      {
        kind: "p",
        text: 'If each row stores its own data-encryption key (DEK) wrapped by the KEK, "re-wrap" is cheap and never touches plaintext: decrypt the little DEK with the old KEK, re-encrypt it with the new one, leave the bulk ciphertext untouched. If instead your content key is HKDF-derived straight from the KEK — no stored DEK — then re-wrap means decrypt-then-reseal the secret itself. That sounds heavier, but for the short secrets this pattern guards (a DSN, an API key — tens of bytes, not gigabytes) it\'s trivial. Either way the version tag is what tells the sweep which branch a given row needs.',
      },
      { kind: "h2", text: "The rule" },
      {
        kind: "p",
        text: "The encrypted blob is the source of truth for how to decrypt it — key version included. Anything you also store in a column is a second copy that can drift from the first, and the day it drifts is the day you can't decrypt a row you thought you could. Put the version where the IV already lives, rotate by bumping a prefix, and let the tag drive both the read path and the sweep. Reach for a column only when you have a query that genuinely can't be answered from the value itself — and key rotation isn't one of them.",
      },
      {
        kind: "p",
        text: "(This is a build note from [nlqdb](https://nlqdb.com), the database you query in plain English — where connection secrets are sealed at rest and the SQL is generated, validated, and shown to you before it runs. Honest split: this is a security-architecture lesson, not a product feature.)",
      },
    ],
  },
  {
    slug: "text-to-sql-planner-told-wrong-dialect",
    title:
      "You added a second SQL engine. Your text-to-SQL model is still being told it's the first one.",
    description:
      "A text-to-SQL planner emits whatever dialect you name it. Add a second engine and the bug is one hardcoded dialect literal the type never forced you to fix — so ClickHouse gets Postgres SQL.",
    date: "2026-07-10",
    body: [
      {
        kind: "p",
        text: "A text-to-SQL model is dialect-aware by design. You hand it a target dialect, and it obliges — name Postgres, get Postgres. So when we added a second engine, ClickHouse alongside Postgres, the model kept doing exactly what it does well: writing SQL for the dialect it was told. The trouble is what it was told. The happy path compiled, the Postgres queries still worked, and a class of analytical questions on the ClickHouse databases started coming back subtly wrong. The model wasn't confused. It was confidently writing Postgres for a database that speaks ClickHouse, because one line told it to.",
      },
      { kind: "h2", text: "The planner was never the problem" },
      {
        kind: "p",
        text: "The prompt already carries a `Dialect:` line — the system prompt says \"emit SQL valid for the named dialect,\" the few-shot exemplars are tagged with theirs. The model reads that field and complies. So the bug isn't in the model or the prompt. It's in the one place that fills the field, and it looks like the most innocent line in the file:",
      },
      {
        kind: "code",
        lang: "ts",
        code: '// The request type — grew for the first two engines, then stopped.\ntype PlanRequest = {\n  goal: string;\n  dialect: "postgres" | "sqlite"; // never grew a "clickhouse" member\n};\n\n// The call site — a literal that was correct exactly once.\nconst plan = await llm.plan({\n  goal: req.goal,\n  dialect: "postgres", // hardcoded; db.engine is right there, unused\n});',
      },
      {
        kind: "p",
        text: 'That `dialect: "postgres"` was true on the day it was written, when Postgres was the only engine. It is a fact frozen into a literal. The database row already knows its real engine — `db.engine` is sitting one field away — but nothing carries that value the few inches into the request. The model is downstream of a lie it has no way to detect.',
      },
      { kind: "h2", text: "Why it hides" },
      {
        kind: "p",
        text: 'Nothing logs "wrong dialect," because from every layer\'s point of view nothing went wrong. The type-checker is happy — `"postgres"` is a valid member of the union. The planner is happy — it got a dialect and emitted valid SQL for it. Every Postgres database on the platform keeps working, so the whole happy path stays green. The failure only surfaces on the analytical grammar that is the entire reason you added the second engine — `LIMIT n BY`, `quantile(0.5)(x)`, `ARRAY JOIN`, `WITH ROLLUP` — none of which the model will ever reach for while it believes it\'s writing Postgres. The feature that justified the new engine is precisely the feature that silently degrades.',
      },
      { kind: "h2", text: "The fix is a value, not a transpile layer" },
      {
        kind: "p",
        text: "The reflex is to reach for a translation layer — write Postgres, run it through SQLGlot or an ANTLR grammar, transpile to ClickHouse. Don't. Those pull a parser-and-grammar bundle that busts an edge/Workers deploy, and they solve a problem you don't have: the model can already write ClickHouse. It just has to be asked. The fix is to make the dialect flow from the row instead of a literal, and — this is the load-bearing half — to make the type refuse to compile until every call site does so.",
      },
      {
        kind: "code",
        lang: "ts",
        code: '// 1. Widen the type. This is what turns the bug into a compile error:\n//    every hardcoded `dialect: "postgres"` call site now fails to build\n//    until it proves it handles the new member.\ntype Dialect = "postgres" | "sqlite" | "clickhouse";\n\n// 2. Map the engine the row already carries to its dialect — one place.\nconst dialectFor = (engine: DbEngine): Dialect =>\n  engine === "clickhouse" ? "clickhouse" : "postgres";\n\n// 3. Thread the value, not a literal.\nconst plan = await llm.plan({\n  goal: req.goal,\n  dialect: dialectFor(db.engine),\n});',
      },
      {
        kind: "p",
        text: "Widening the type first is the trick that makes this safe. Add `\"clickhouse\"` to the union and the compiler walks you to every call site that still hardcodes the first engine — the two plan sites, the retry-repair site, anywhere a literal slipped in. A runtime bug you'd have to catch with a live ClickHouse database and a discerning eye becomes a build error you can't merge past. You are not trusting yourself to remember every place; you are making the type remember for you.",
      },
      { kind: "h2", text: "The generator and the validator are twins" },
      {
        kind: "p",
        text: "There's a matching bug one layer down, and it's worth fixing in the same breath. The [SQL validator makes the same first-engine assumption](/blog/postgres-validator-rejects-valid-clickhouse-sql/): a Postgres-pinned parser false-rejects valid ClickHouse grammar as a parse failure. Fix the generator alone and you've just relocated the damage — now the planner correctly emits ClickHouse SQL and the validator vetoes it as invalid. The generator and the validator both silently assume engine #1, and they have to stop assuming it together, or you trade a wrong-answer bug for a rejected-query bug.",
      },
      { kind: "h2", text: "The rule" },
      {
        kind: "p",
        text: "When you add a second engine, the dialect stops being config you set once and becomes a value that must flow from the row on every request. Grep for every place the first engine's name appears as a literal — that list is your bug list. Then widen the dialect type before you touch anything else, so the compiler converts the ones you'd have missed from silent wrong answers into loud build failures. A frozen literal is a fact that was true once; the type is what keeps it from staying true after it isn't.",
      },
      {
        kind: "p",
        text: "(This is a build note from [nlqdb](https://nlqdb.com), the database you query in plain English — where the SQL is generated, validated, and shown to you before it runs. Honest split: this is an architecture lesson about multi-engine prompting, not a product feature.)",
      },
    ],
  },
  {
    slug: "postgres-validator-rejects-valid-clickhouse-sql",
    title: "You added ClickHouse. Your Postgres SQL validator now rejects valid queries — quietly.",
    description:
      "A Postgres-pinned AST validator false-rejects valid ClickHouse grammar as parse_failed — a silent veto of correct SQL. The fix: split the security allowlist from the dialect parser.",
    date: "2026-07-09",
    body: [
      {
        kind: "p",
        text: "We generate SQL from plain English, and before any of it touches a database we validate it. So when we added a second engine — ClickHouse alongside Postgres — the tempting move was obvious: reuse the validator we already trust. It ran clean, the tests were green, and a class of real user questions started coming back `parse_failed` for no reason anyone could see. The validator wasn't broken. It was doing exactly what it was told, on the wrong engine.",
      },
      { kind: "h2", text: "One parser, pinned to one dialect" },
      {
        kind: "p",
        text: 'Our validator is an AST parse — `node-sql-parser`, configured `database: "PostgreSQL"`. Point that at a ClickHouse database and valid analytical grammar the query planner correctly emits — `LIMIT n BY`, `quantile(0.5)(x)`, `ARRAY JOIN`, `WITH ROLLUP` — fails the parse. The user asked a perfectly good question, the model wrote perfectly good ClickHouse, and the guardrail in the middle rejected it. Nothing in the logs said "wrong dialect." It just said the query was invalid, which it wasn\'t.',
      },
      {
        kind: "p",
        text: "The seductive part is that it never looks like a dialect bug. Every Postgres query still validates. The happy path is green. The failure only shows up on the analytical grammar that is the entire reason you added ClickHouse in the first place — so the feature that motivated the second engine is precisely the feature the validator quietly vetoes.",
      },
      { kind: "h2", text: "The fix is not a second parser" },
      {
        kind: "p",
        text: "The reflex is to go find a ClickHouse parser. Don't. `node-sql-parser` has no ClickHouse dialect, and the ANTLR4 grammars that do are far too heavy for an edge/Workers bundle. Chasing a per-engine parser is chasing the wrong problem — because the validator was never really one job.",
      },
      {
        kind: "p",
        text: "Look at what it actually does and it splits cleanly in two. First, it enforces a destructive-verb allowlist — no `DROP`, no `DELETE`, no `TRUNCATE` reaching a read path. Second, it walks the AST to catch a dangerous verb smuggled inside a CTE or subquery. Only the second job needs a parser. The first is a leading-verb check — dialect-agnostic, already correct on every engine, because `DROP` is `DROP` in ClickHouse and Postgres alike.",
      },
      {
        kind: "code",
        lang: "ts",
        code: '// Security-load-bearing: dialect-agnostic, authoritative on EVERY engine.\n// A leading destructive verb is a hard reject regardless of parser support.\nconst DESTRUCTIVE = /^\\s*(drop|delete|truncate|alter|update|insert|grant|revoke)\\b/i;\nif (DESTRUCTIVE.test(sql)) return reject("destructive_verb");\n\n// Defense-in-depth: AST walk for a verb smuggled into a CTE/subquery.\n// Best-effort PER ENGINE — a parse failure here means "wrong parser for\n// this dialect", NOT "dangerous query". It must never veto a valid query.\ntry {\n  const ast = parse(sql, { database: dialectFor(engine) });\n  if (hasNestedDestructive(ast)) return reject("destructive_verb");\n} catch {\n  // ClickHouse grammar the PG parser can\'t read lands here. That is not\n  // a security signal. The allowlist above already made the safety call.\n}\nreturn allow();',
      },
      { kind: "h2", text: "Why the layering matters" },
      {
        kind: "p",
        text: "Once the two jobs are separated, the security-load-bearing layer works on every engine and the dialect-locked layer degrades gracefully. A parse failure from the wrong dialect stops being a verdict on whether the query is safe and becomes what it always was: a statement about which parser you happened to load. The allowlist already made the safety call, up front, on grammar that never varies. So you lose nothing on security and you stop rejecting correct SQL.",
      },
      {
        kind: "p",
        text: "This is the same instinct behind layered guardrails everywhere: no single rule is trusted to be both complete and correct on every input. The widely-reported agent-that-dropped-a-production-database incident had multiple safeguards and still lost data — the lesson isn't \"add one perfect check,\" it's that the authoritative safety layer has to hold even when a best-effort layer above it can't run.",
      },
      { kind: "h2", text: "The rule" },
      {
        kind: "p",
        text: 'In a multi-engine guardrail, a parse failure from the wrong dialect means "wrong parser," not "dangerous query" — never let it decide whether a valid query runs. Keep the dialect-agnostic allowlist authoritative on every engine; make the AST parse best-effort per engine. When you add a second dialect, the bug won\'t announce itself as a dialect bug — it\'ll look like a validator that\'s merely stricter than you remembered. Check what your guardrail is actually pinned to before you trust its rejections.',
      },
      {
        kind: "p",
        text: "(This is a build note from [nlqdb](https://nlqdb.com), the database you query in plain English — where the SQL is generated, validated, and shown to you before it runs. Honest split: this is an engineering lesson about multi-engine guardrails, not a product feature.)",
      },
    ],
  },
  {
    slug: "blog-without-a-feed-is-a-dead-end",
    title: "We published 20 blog posts and never shipped a feed. Nothing could subscribe.",
    description:
      "A blog with no RSS feed is a one-way street: feed readers and dev.to/Medium 'import from RSS' both need a feed URL. Without one, every venue re-post is a manual copy-paste that quietly stops.",
    date: "2026-07-09",
    body: [
      {
        kind: "p",
        text: "For weeks the blog grew and the reach didn't. We published post after post — engineering notes, SQL traps, honest comparisons — and every one rendered fine at its own URL. Anyone who already knew the URL could read it. That was the whole reach: people we'd already reached. The pages were live, and publishing felt done. It wasn't. Publishing a page and publishing a *feed* are two different acts, and we'd only done the first.",
      },
      { kind: "h2", text: "Publishing ends when a machine can subscribe, not when a page renders" },
      {
        kind: "p",
        text: "A web page is something a human pulls up once. A feed is something a machine subscribes to and pulls forever. Everything that redistributes your writing — every reader, every aggregator, every cross-post integration — is a machine, and a machine needs a stable URL that lists your posts in a format it can parse. That URL is your RSS or Atom feed. Without it, your content has doors a human can walk through one at a time and no door a machine can automate. The blog isn't dead; it's just sealed to everything that would spread it.",
      },
      { kind: "h2", text: "What a feed unlocks that a page can't" },
      {
        kind: "ul",
        items: [
          "**Feed readers.** Feedly, Inoreader, NetNewsWire — the people most likely to follow an engineering blog live in a reader. No feed URL, no way to follow. You are invisible to your most loyal potential audience.",
          "**Auto-import to high-authority venues.** dev.to, Medium, and Hashnode all have an 'import your posts from RSS' setting: point it at your feed and every new post auto-mirrors to a domain with far more indexing authority than yours — with a `rel=canonical` link pointing back, so the SEO credit still accrues to your copy. This is the part that actually moves the yield needle, and it is impossible without a feed URL.",
          "**Everything else that speaks RSS.** Newsletter tools, Slack/Discord post bots, IFTTT/Zapier automations — the long tail of redistribution all keys off one feed URL. Ship it once and every one of these becomes a config field instead of a project.",
        ],
      },
      {
        kind: "p",
        text: "Without a feed, each of those becomes a manual copy-paste: open the venue, paste the title, paste the body, fix the formatting, set the canonical link by hand. It works for exactly as long as your discipline holds, and then it quietly stops — the third week you're busy, the re-posts don't happen, and nobody notices because there's no error, just silence.",
      },
      { kind: "h2", text: "The fix was about 40 lines and no dependency" },
      {
        kind: "p",
        text: "The obvious move is to reach for a plugin — for us, `@astrojs/rss`. We didn't. Our posts already live in one typed data file that the sitemap and the `llms.txt` endpoint both read; a feed is a third reader of the same array. So it's a hand-rolled endpoint that maps each post to an RSS `<item>`, the exact no-dependency pattern the sitemap already uses, and it runs on Cloudflare Workers with nothing to bundle.",
      },
      {
        kind: "code",
        lang: "ts",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: this is sample source shown to the reader — the ${…} are real template literals in the example, not a placeholder bug.
        code: 'import type { APIRoute } from "astro";\nimport { BLOG_POSTS } from "../data/blog";\n\n// Titles/descriptions are free text → XML-escape before embedding.\nconst esc = (s: string) =>\n  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");\n\nexport const GET: APIRoute = () => {\n  const items = BLOG_POSTS.map((p) =>\n    `<item>\\n` +\n    `  <title>${esc(p.title)}</title>\\n` +\n    `  <link>https://nlqdb.com/blog/${p.slug}/</link>\\n` +\n    `  <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>\\n` +\n    `  <description>${esc(p.description)}</description>\\n` +\n    `</item>`,\n  ).join("\\n");\n\n  const body = `<?xml version="1.0" encoding="UTF-8"?>\\n` +\n    `<rss version="2.0"><channel>\\n${items}\\n</channel></rss>`;\n\n  return new Response(body, {\n    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },\n  });\n};',
      },
      {
        kind: "p",
        text: 'Two details earn their place. First, **XML-escape the free text** — titles and descriptions are prose, not known-safe URLs, so an unescaped `&` or `<` produces a feed that won\'t parse (this is the one thing the sitemap endpoint gets to skip, because it only ever emits URL paths). Second, add one `<link rel="alternate" type="application/rss+xml">` to the site\'s `<head>` so browsers and readers *autodiscover* the feed from any page — the endpoint exists, but this is what lets a reader find it by pasting your homepage instead of hunting for `/rss.xml`.',
      },
      { kind: "h2", text: "The rule" },
      {
        kind: "p",
        text: "**Count the doors into your content, not the pages.** A page count measures how much you wrote; a feed measures how many ways that writing can leave your site without you lifting a finger. A post nobody can subscribe to is a post nobody re-shares — and the gap doesn't show up as an error, it shows up as a referral graph that stays flat while the sitemap keeps growing. If you've been publishing for weeks and the reach isn't compounding, check whether a machine can even subscribe.",
      },
      {
        kind: "p",
        text: "(This blog is the daily build log for [nlqdb](https://nlqdb.com), the data layer you query in plain English. The feed above is real — every post here is auto-importable, `rel=canonical` back to this domain, from the same typed file that renders the page you're reading.)",
      },
    ],
  },
  {
    slug: "agent-memory-benchmarks-measure-recall-not-analysis",
    title: "We read the agent-memory benchmarks. Almost none measure analysis.",
    description:
      "Agent-memory benchmarks score end-to-end recall of facts on mostly self-reported numbers. Almost nobody measures analysis over memory — the gap we found reading the papers.",
    date: "2026-07-09",
    anchor: {
      label: "Run analytical queries over agent memory",
      path: "/solve/analytical-queries-over-agent-memory",
    },
    body: [
      {
        kind: "p",
        text: "We're building nlqdb as analytical memory for AI agents — a real database an agent queries with `GROUP BY` and `JOIN`, not a fuzzy fact store. So before writing our own memory-quality benchmark, we read the ones the field already uses: LoCoMo, LongMemEval, and Mem0's and Zep's evaluations. The short version: almost none of them measure what we assumed, and almost every headline number is self-reported.",
      },
      { kind: "h2", text: "What the benchmarks actually score" },
      {
        kind: "p",
        text: "The canonical benchmarks are end-to-end question-answering suites. LoCoMo (Snap Research, ACL 2024) builds very long multi-session dialogues — around 300 turns over up to 35 sessions — and asks single-hop, multi-hop, temporal, commonsense, and adversarial questions, graded by string-match F1. LongMemEval (ICLR 2025) embeds 500 questions across five separately-scored abilities: information extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention. Both grade whether the final answer is right — not whether the right memory was retrieved.",
      },
      {
        kind: "p",
        text: "That distinction matters. In classic retrieval you measure `recall@k`, `precision@k`, `MRR`, and `nDCG` against labeled-relevant items. We went looking for those numbers in agent-memory evaluations and mostly didn't find them: the field grades QA accuracy (or an LLM-as-judge), not component-level retrieval. There is no agreed ground-truth-relevance standard for agent memory. If you want to measure retrieval quality directly, you have to label relevance yourself.",
      },
      { kind: "h2", text: "Almost every headline number is self-reported" },
      {
        kind: "p",
        text: "Mem0 reports a 26% relative improvement over OpenAI's memory on LoCoMo; Zep reports 94.8% on Deep Memory Retrieval and up to 18.5% on LongMemEval. Read the author lists: these are the vendors' own papers. None has been cleanly reproduced by a neutral third party, and the two vendors publicly dispute each other's LoCoMo methodology. The benchmark itself is soft — an independent audit found roughly 6.4% of LoCoMo's answer key is simply wrong, and re-scoring with a corrected judge prompt swung one system from 84% to 58%. Treat every leaderboard number as directional, not settled.",
      },
      { kind: "h2", text: "The thing nobody measures: analysis over memory" },
      {
        kind: "p",
        text: 'Here\'s the gap that matters for us. Every system in the field stores facts and retrieves them. A vector store can recall "Alice has a $50k deal." What none of them benchmark — and most structurally can\'t do — is analysis over that memory: "show the top 5 deals by value, grouped by stage, for enterprise accounts only." That\'s a `GROUP BY` with a `HAVING` and a `JOIN`, and a fuzzy fact store has no query planner to run it. We could not find a single benchmark that isolates analytical queries over episodic memory against vector or graph memory on identical data. The field measures recall of facts, not reasoning across them.',
      },
      {
        kind: "p",
        text: "There's even supporting evidence hiding in LoCoMo's own results: restructuring raw dialogue into a \"database of assertions\" lifted temporal-question F1 from 21.3 to 41.9. Structure helps most exactly where LLMs are weakest — temporal and multi-hop reasoning.",
      },
      { kind: "h2", text: "Where a database does not win (the honest part)" },
      {
        kind: "p",
        text: 'A real database is not a free win everywhere, and pretending otherwise would be dishonest. For fuzzy semantic recall over unstructured text — "find the thing I said that\'s kind of like this" — embedding similarity still beats exact SQL. Every serious system relies on it, including the most database-native academic proposal we found, which is Postgres-based and still falls back to `pgvector` nearest-neighbor. Pure analytical SQL cannot replace vector search for unstructured recall. The honest wedge is analytical memory, not memory without embeddings — which is why hybrid recall is on our roadmap, not our marketing.',
      },
      { kind: "h2", text: "What we're building" },
      {
        kind: "p",
        text: "We're adding an agent-memory-quality eval to the same benchmark harness we already run for text-to-SQL accuracy. It scores four axes: retrieval precision and recall (against relevance labels we define, since the field has none), temporal reasoning, forgetting and contradiction resolution, and consolidation. And it includes the analytical-memory task nobody else runs: aggregation and ordering over episodic memory, head-to-head against a vector-recall baseline on the same data — reported honestly, including the questions where a pure-SQL store loses. We'll publish the numbers here as they land, reproducible, not self-graded.",
      },
      {
        kind: "p",
        text: "If you're building an agent and you want its memory to answer questions, not just echo facts back, that's the whole idea. You can point an agent at a live nlqdb database and start asking in plain English.",
      },
    ],
  },
  {
    slug: "one-way-internal-links-leak-yield",
    title: "We shipped 18 SEO pages and got 1 referral. The links only pointed one way.",
    description:
      "The page count climbed; referrals stayed flat at ~1/week. Our internal link graph was a tree, not a mesh. The fix was one reciprocal link, derived from a field we already had.",
    date: "2026-07-08",
    body: [
      {
        kind: "p",
        text: "For a few weeks the surface count was the number that moved. Comparison pages, how-to pages, engineering posts — the sitemap kept growing. Referral traffic did not. It sat at roughly one external visit a week the whole time. More pages, same trickle. When volume climbs and yield doesn't, the pages aren't the problem; the graph connecting them is.",
      },
      { kind: "h2", text: "A tree, not a mesh" },
      {
        kind: "p",
        text: "We drew our own internal links and the shape was obvious in hindsight. Every blog post linked *down* to the deep guide it anchored — a post about duplicate-row detection linked to `/solve/find-duplicate-rows-in-my-data`, a comparison post linked to `/vs/mode`. Nothing linked back up. `/blog → /solve`, never `/solve → /blog`. The graph was a tree with the deep pages as leaves, and the freshest content — the posts we most needed crawled and indexed — hung off the ends with zero internal inbound links.",
      },
      {
        kind: "p",
        text: "That one-way arrow costs you twice, once for machines and once for humans.",
      },
      { kind: "h2", text: "Cost one: authority flows the way the link points" },
      {
        kind: "ul",
        items: [
          "**Links pass authority in the direction they point.** Every forward link we shipped fed the deep evergreen page and starved the new post. The URL that most needed a crawl signal — the one published yesterday — was the one with no internal links pointing at it.",
          "**A page with zero internal inbound links is nearly invisible to a crawler.** The sitemap tells a bot the URL *exists*; internal links tell it the URL *matters*. We were publishing pages that only the first told anyone about.",
          "**Fresh pages have the shortest runway.** An evergreen guide accrues links over months. A post has days to prove it's worth indexing. Pointing all the authority the other way is exactly backwards.",
        ],
      },
      { kind: "h2", text: "Cost two: a one-way link is a dead end for a reader" },
      {
        kind: "p",
        text: "The human cost is simpler and you can feel it. A searcher lands on `/solve/find-top-n-rows-per-group` from Google, reads the answer, and… stops. There is no next hop. The session is one page long, the reader bounces, and the analytics tell you the page 'didn't engage' when really it just had nowhere to send anyone. A page that answers a question and then offers the obvious follow-up keeps the reader on the site; a page that answers and then goes quiet hands them back to the search results.",
      },
      { kind: "h2", text: "The fix was a field we already had" },
      {
        kind: "p",
        text: 'Each post already declared the guide it anchored — a typed `anchor` field with a label and a path, used to render the forward link. That field is bidirectional information; we were only reading it one way. The deep page knew nothing about the posts pointing at it, but the posts knew exactly which deep page they belonged to. So we inverted the same data: at build time, for each `/solve` and `/vs` page, collect the posts whose `anchor` names it and render a reciprocal "Further reading" link back. No new content, no new data model — one derived link per relationship, generated from the field that already drove the forward one.',
      },
      {
        kind: "code",
        lang: "ts",
        code: "// The forward link already existed on each post:\n//   anchor: { label: 'Find top-N rows per group', path: '/solve/...' }\n//\n// Invert it once, at build time, to get every backlink for free:\nconst backlinks = new Map<string, BlogPost[]>();\nfor (const post of BLOG_POSTS) {\n  if (!post.anchor) continue;\n  const list = backlinks.get(post.anchor.path) ?? [];\n  list.push(post);\n  backlinks.set(post.anchor.path, list);\n}\n// /solve/[slug] and /vs/[slug] now render backlinks.get(currentPath)\n// as a 'Further reading' block — the mesh closes with zero new data.",
      },
      {
        kind: "p",
        text: "Every anchored deep page now has at least one internal inbound link, and every post has a two-way relationship with the guide it belongs to. The link count went up without a single new page; the graph went from a tree to a mesh. ([nlqdb](https://nlqdb.com) is the database you talk to; this is one of the notes from building it in the open.)",
      },
      { kind: "h2", text: "The lesson: measure the graph, not the count" },
      {
        kind: "p",
        text: "Publishing volume is not distribution. A pile of pages that only link one direction is a stack of dead ends wearing a sitemap. The metric that actually predicts yield is the shape of the internal link graph — how many pages a reader (or a crawler) can reach from any starting point, and whether authority can flow to the pages that need it. Before you write the next page, check that the last one links both ways. The cheapest distribution win is usually a link you already have the data to draw.",
      },
    ],
  },
  {
    slug: "serverless-db-cold-start-retry",
    title: "Your database scales to zero. Your retry loop doesn't know that.",
    description:
      "A scale-to-zero Postgres branch fails the first query while its compute wakes. Instant retries replay the cold connection. The fix: back off the DB stage, not the LLM stages.",
    date: "2026-07-08",
    body: [
      {
        kind: "p",
        text: "Serverless Postgres is wonderful until the first query after an idle spell. A free-tier Neon branch parks its compute after ~5 minutes of no traffic; the next query has to wake it, and that first connection can fail while the compute spins back up. We had a retry loop in front of it — three attempts, textbook. It made things worse. The retries fired so fast they all hit the same cold connection, and the user got a crisp `db_unreachable` about 40 ms after the database had already started waking up.",
      },
      { kind: "h2", text: "One retry loop, two completely different failures" },
      {
        kind: "p",
        text: "Our `/v1/ask` pipeline has three stages that can each throw a transient: `route` (an LLM classifier call), `plan` (the LLM emits SQL), and `exec` (the query hits the database). We wrapped all three in the same helper — three attempts, then surface. The mistake was assuming a retry is a retry. It isn't. The *right delay between attempts depends on why the stage failed*, and the two failure modes here want opposite things.",
      },
      {
        kind: "p",
        text: "When an LLM call fails, it's usually one provider returning a 5xx or a rate-limit. The fix is to fail over to a sibling provider — and you want to do that **immediately**, because the sibling is a different machine that is already warm. Any delay is dead time on a spinner. But when `exec` fails on a cold serverless branch, the fix is the opposite: the *same* endpoint needs a moment of wall-clock time to become reachable. Retrying it instantly just re-dials a socket that isn't listening yet.",
      },
      { kind: "h2", text: "The bug: instant retries replay a cold connection" },
      {
        kind: "p",
        text: "With a zero-delay loop, all three exec attempts land inside the same few tens of milliseconds — before the compute has finished resuming. Three cold dials, three failures, then a `502 db_unreachable` handed to the user. The surface then *lies*: it says we couldn't reach the database, when in truth we reached it three times in a row while it was mid-boot and gave up ~600 ms before it would have answered. The retries didn't absorb the transient. They burned through the budget the transient needed.",
      },
      { kind: "h2", text: "Back off the stage that needs wall-time, not the one that doesn't" },
      {
        kind: "p",
        text: "The fix is one option on the retry helper: an optional per-stage backoff. `route` and `plan` keep retrying instantly — their transient is a provider that fails over to a warm sibling with no benefit to waiting. Only `exec` opts into a delay, and only because its dominant transient is a compute that needs to wake up.",
      },
      {
        kind: "code",
        lang: "ts",
        code: '// route + plan: an LLM provider 5xx\'d. Fail over to a sibling\n// provider on the NEXT attempt, instantly — waiting buys nothing,\n// the sibling is a different machine and already warm.\nawait withStageRetry("plan", planOnce);\n\n// exec: the dominant transient is a scale-to-zero Postgres compute\n// that needs wall-time to resume. Back off so attempts 2/3 land warm.\nawait withStageRetry("exec", runQuery, {\n  backoffMs: (failedAttempt) => 300 * 2 ** (failedAttempt - 1), // 300ms, then 600ms\n});',
      },
      {
        kind: "p",
        text: "The timeline: attempt 1 at t=0 (cold, fails), wait 300 ms, attempt 2 at t=300 ms, wait 600 ms, attempt 3 at t=900 ms. A free-tier Neon compute resumes inside that ≤900 ms window, so attempt 3 lands warm and the query returns — the user never sees the cold start. The happy path is untouched: a database that's already awake answers on attempt 1 and never sleeps a millisecond. The backoff is pure failure-path cost, paid only by the request that would otherwise have failed outright.",
      },
      { kind: "h2", text: "Prove it without a flaky database" },
      {
        kind: "p",
        text: "A cold-start bug you can only reproduce by waiting five minutes for a real branch to idle is a bug you will never keep fixed. So we made the delay injectable — the helper takes a `sleep` function, real timers in prod, a fake clock in the test. The test models a branch that stays unreachable until t=700 ms: **without** backoff, all three instant attempts land before 700 ms and the request surfaces `db_unreachable`; **with** the exec backoff, attempt 3 lands at t=900 ms and recovers. Same code path, deterministic, no real database, no five-minute wait. The regression can't silently come back.",
      },
      { kind: "h2", text: "The rule" },
      {
        kind: "p",
        text: '**A retry policy is not one setting — it\'s one per failure mode.** Before you pick a backoff, ask what the retry is actually waiting *for*. Waiting for a different machine to answer? Don\'t wait — fail over now. Waiting for the *same* machine to wake up? The wait is the entire point, and retrying without it is just three ways to fail at the same instant. The error message that says "unreachable" is often really saying "you asked 600 ms too early."',
      },
      {
        kind: "p",
        text: "(This runs under every question you ask [nlqdb](https://nlqdb.com), the data layer you talk to in English: the LLM stages fail over between providers instantly, the database stage backs off just long enough for a scale-to-zero branch to wake, and a cold start turns into a slightly slower answer instead of an error.)",
      },
    ],
  },
  {
    slug: "llm-timeout-looks-like-hallucination",
    title: "The timeout that looked like a hallucination",
    description:
      "Our NL→SQL benchmark scored a frontier model as junk on 5 hard questions. It never hallucinated — a 5s prod timeout aborted it mid-answer and the handler mislabeled the abort as a parse failure.",
    date: "2026-07-07",
    body: [
      {
        kind: "p",
        text: 'Our NL→SQL benchmark reported that a frontier model "emitted junk" — non-SQL, unparseable — on 5 of 150 hard questions, dragging its score below a floor a frontier model has no business sitting under. The number was real. The explanation was wrong. The model never hallucinated on those five. It was answering fine and we killed it mid-sentence, then filed the crime under the wrong charge.',
      },
      { kind: "h2", text: "The clamp you measure instead of the model" },
      {
        kind: "p",
        text: "The request layer aborted every model call at a 5-second timeout — a budget **inherited from the production hot path**, where a user is staring at a spinner and 5 seconds is already too long. That budget is correct for what ships. It is exactly wrong for a benchmark, whose entire job is to measure what the model *can* do, not what fits in a latency SLA. A reasoning model on a hard schema wants seconds of chain-of-thought; a 5-second clamp truncates it. So the benchmark wasn't scoring the model. It was scoring the clamp — and reporting the clamp's verdict as the model's.",
      },
      {
        kind: "p",
        text: 'The rule that fell out of this: **a benchmark\'s timeout budget is a measurement instrument, not a config value to reuse.** Separate "what ships" (the prod hot-path budget) from "what the model can do" (the eval budget). Point the frontier eval lane at its own generous budget and the score jumps to reflect the model, not the SLA. That single change lifted the lane off its false floor.',
      },
      { kind: "h2", text: "An aborted read is not a parse error" },
      {
        kind: "p",
        text: "The second bug is why the truncation disguised itself. When the timeout fired, an `AbortController` cancelled the in-flight fetch. The code was mid-`res.json()`, so that read rejected — and the surrounding `catch` did the natural, wrong thing: no JSON, therefore the model returned something unparseable, therefore classify it `parse` (model emitted non-SQL). But the read didn't fail because the body was junk. It failed because *we* pulled the plug. The abort and the parse failure land in the same `catch`, and only one of them is the model's fault.",
      },
      {
        kind: "code",
        lang: "ts",
        code: 'try {\n  const json = await res.json();\n  return classify(json);\n} catch (err) {\n  // WRONG: every failure here reads as "model returned non-SQL"\n  return { failure: "parse" };\n}\n\n// Right: the signal tells you who aborted the read.\ntry {\n  const json = await res.json();\n  return classify(json);\n} catch (err) {\n  if (controller.signal.aborted) return { failure: "timeout" }; // infra, not model\n  return { failure: "parse" };                                   // genuinely unparseable\n}',
      },
      {
        kind: "p",
        text: 'Classify by the signal state, not by "the JSON didn\'t parse." An `AbortError` when your own controller fired is a `timeout` — an infra event you own — not a model-quality datapoint. Conflate them and every timeout inflates your hallucination rate and deflates the model.',
      },
      { kind: "h2", text: "The tell was in the latencies" },
      {
        kind: "p",
        text: 'We should have caught this without reading a line of code, because the evidence was sitting in the numbers. Every single "hallucination" had a latency of 5000–5004 ms. Real model failures scatter across the latency distribution; these were pinned to the wall, all five clustered at exactly the timeout. A failure mode that always takes the same round number of milliseconds is never the model — it\'s a clock. **Log per-attempt latency next to every failure**, or you will stare at a bogus quality regression and never see the fingerprint.',
      },
      { kind: "h2", text: "The honest split" },
      {
        kind: "p",
        text: "This is eval-harness measurement integrity, not a claim that the model is better than you thought — though in this case it was. None of it makes a weak model strong. It stops an infra artifact from being scored as incompetence. If you benchmark any model behind a timeout: give the eval its own budget separate from prod, classify aborts by the signal not the exception, and log the latency next to the verdict. Otherwise the first thing your benchmark measures is your own patience.",
      },
      {
        kind: "p",
        text: "(This is how we score the frontier lane for [nlqdb](https://nlqdb.com), the data layer you ask in English — the eval harness runs a separate capability budget from the production ask path, so the number reflects the model, not the SLA.)",
      },
    ],
  },
  {
    slug: "model-preset-fail-loud",
    title: 'Your "best model" toggle quietly serves the cheap model. Ship a 409 instead.',
    description:
      "When the premium lane isn't available, the tempting branch is to silently serve the default chain. A placebo knob is worse than no knob. The honest contract: pin, upgrade, or fail loud.",
    date: "2026-07-07",
    body: [
      {
        kind: "p",
        text: "Every AI product has a model picker now — Fast / Balanced / Best, or a dropdown of names. You add one to your app. Then you hit the branch that decides how good a knob it is: the user picked **Best**, but the premium lane isn't available right now. No API key on file, no paid plan, the metered lane is dark. What do you do?",
      },
      {
        kind: "p",
        text: "The tempting answer is to quietly serve the default chain. The request succeeds, an answer comes back, nobody sees an error. It feels graceful. It is the single worst thing you can do, and it took us a review pass to stop doing it ourselves.",
      },
      { kind: "h2", text: "A placebo knob is worse than no knob" },
      {
        kind: "p",
        text: 'When "Best" silently downgrades to "cheapest", the user asked for one thing and got another, and the *only* signal they ever get is quality variance. Their answers are a little worse than they expected, intermittently, for reasons they can\'t see. They won\'t file a bug that says "the Best toggle is a no-op" — they\'ll conclude your product is unreliable and churn. You\'ve spent UI real estate and a database column building a control that lies, and the lie is expensive precisely because it\'s invisible.',
      },
      {
        kind: "p",
        text: "A product with no picker at all is more honest: it makes no promise it can't keep. So if you ship the knob, the knob has to never lie about which chain answered.",
      },
      { kind: "h2", text: "The honest contract is three lines" },
      {
        kind: "ol",
        items: [
          "`fast` **pins the cheap chain — always.** Even when a stored provider key *would* auto-upgrade the request. An explicit per-request instruction beats an ambient credential: the caller who wrote `model: fast` into a nightly CI job means it, and silently spending their premium budget because a key happens to be on file is the same betrayal in the other direction.",
          "`best` **gets a real frontier lane, or it fails loud.** If the premium lane is live for this caller, route to it. If not, return a `409` with a machine-branchable error code (`model_unavailable`) and a fix-it link — not a 200 with a trace note nobody reads. An error the caller can branch on is a contract; a buried warning is a shrug.",
          "`auto` / absent **stays the default chain.** No opinion expressed, no promise made, cheapest-that-works — the behavior you already had before the knob existed.",
        ],
      },
      {
        kind: "code",
        lang: "typescript",
        code: '// one pure function, shared by every surface\nfunction selectDispatchLane(preset, caller) {\n  if (preset === "fast") return { lane: "free" };        // pin, ignore stored keys\n  if (preset === "best") {\n    return caller.hasFrontierLane\n      ? { lane: "frontier" }\n      : { error: "model_unavailable", status: 409, link: FIX_IT_URL };\n  }\n  return { lane: caller.defaultLane };                    // auto / absent\n}',
      },
      { kind: "h2", text: "The refusal is your demand signal" },
      {
        kind: "p",
        text: "Here's the bonus that makes failing loud strictly better than degrading quietly. Every `model_unavailable` you return is a user telling you, in the clearest possible terms, that they want a paid lane you haven't lit yet. Count them and you have a demand curve with an honest denominator — real requests for the upgrade, not survey wishes. A silent downgrade throws that signal away; a 409 files it for you.",
      },
      { kind: "h2", text: "Make it one function, or your surfaces will drift" },
      {
        kind: "p",
        text: "The trap after you get the contract right is re-implementing it per surface. Your HTTP API, SDK, CLI, MCP server, and web app each resolve the preset, and the fourth one you write will subtly disagree with the first — one of them forgets the anonymous short-circuit and serves `best` off the free path before the lane check ever runs. Put the precedence in one pure function every surface calls, cover it with one test file, and the knob means the same thing everywhere by construction.",
      },
      { kind: "h2", text: "The rule" },
      {
        kind: "p",
        text: "**A model knob is a contract, not a capability.** The free chain still answers most questions fine — this was never about having the best model. It's about the toggle never lying about which chain answered. Pin when told to pin, upgrade when you can, and fail loud with a code the caller can act on when you can't. Anything else is a placebo, and placebos cost you the trust you built the picker to earn.",
      },
      {
        kind: "p",
        text: "(This is how the model preset works on [nlqdb](https://nlqdb.com), the data layer you ask in English: `fast` pins the free chain, `best` gets a frontier lane or a `409 model_unavailable` with a fix-it link, and one shared function resolves it across the API, SDK, CLI, MCP server, and the `<nlq-data>` element — so the knob can't drift and can't lie.)",
      },
    ],
  },
  {
    slug: "llm-preflight-probe-health",
    title: "Your LLM health probe passed. Your agent still starved.",
    description:
      "Six straight LLM-agent CI runs failed while our pre-flight probe stayed green. Lessons on gating CI on an LLM provider: probe the real shape, read the body not the status, never trust one model.",
    date: "2026-07-07",
    body: [
      {
        kind: "p",
        text: "We gate an end-to-end suite on a live free LLM: before the agent test runs, a pre-flight probe checks the model is up. The probe was green. The suite failed anyway — six runs in a row. Every failure was the agent starving mid-task on a model the probe had just certified healthy. Here is what a health probe in front of an LLM provider has to actually check, learned one red run at a time.",
      },
      { kind: "h2", text: "1. Probe the exact shape you'll use — not a 1-token ping" },
      {
        kind: "p",
        text: 'The cheap probe is a one-token completion: send "hi", get a token back, call it healthy. But your agent doesn\'t send "hi" — it does a tool-call round trip: system prompt, tool schemas, a turn that must emit a well-formed tool call. A model (or a saturated free pool) can return a token for "hi" and still fail to produce a valid tool call under load. Probe the shape you depend on. Ours now does a real tool-call round trip and asserts the response parses as a tool invocation, because that is the capability the suite needs — not liveness.',
      },
      { kind: "h2", text: "2. Check the body, not the status" },
      {
        kind: "p",
        text: "This one cost us the most time. The probe checked `res.ok` and moved on. But an AI gateway in front of the provider wraps an upstream 429 in an HTTP 200 envelope — the transport succeeded, the body carries the error. `res.ok` is necessary, never sufficient, for anything behind a gateway.",
      },
      {
        kind: "code",
        lang: "ts",
        code: '// Looks healthy. Isn\'t.\nconst res = await fetch(gatewayUrl, { ... });\nif (res.ok) return "healthy"; // 200 wrapping an upstream 429\n\n// The upstream status lives in the body.\nconst json = await res.json();\nif (json.error || json.choices?.[0]?.finish_reason === "error") {\n  return "unhealthy";\n}',
      },
      { kind: "h2", text: "3. Saturated free pools flap — require N consecutive healthy probes" },
      {
        kind: "p",
        text: 'A single healthy probe against a free model pool is a coin flip when the pool is busy: the next request lands on a different, throttled backend. One green probe means "a backend was free 40 ms ago," not "the pool is healthy." We now require three consecutive healthy probes before the gate opens — enough to distinguish a stable pool from a flapping one, cheap enough to stay fast.',
      },
      { kind: "h2", text: "4. Probe-time health can't promise a 15-minute window" },
      {
        kind: "p",
        text: "Even three green probes only certify the moment they ran. A suite that takes fifteen minutes will outlive that certification — the pool that was healthy at minute zero can throttle at minute nine. A pre-flight gate reduces the odds of starting a doomed run; it cannot guarantee the run finishes. Pair the gate with client-side backoff and retry inside the run, so a mid-run throttle is absorbed instead of failing the suite. The gate and the backoff do different jobs; you need both.",
      },
      { kind: "h2", text: "5. Never hard-code one model — walk an ordered candidate list" },
      {
        kind: "p",
        text: "Our six red runs all pointed at one hard-coded free model. When that single model's pool got busy, there was no fallback and no signal beyond a failed suite. The fix is an ordered candidate list: probe the first, fall through to the next on an unhealthy verdict, and run against the first that clears. One model is a single point of failure you control — so don't build one.",
      },
      { kind: "h2", text: "6. Probe-healthy is not agent-competent" },
      {
        kind: "p",
        text: "The subtlest lesson: a model can ace the probe and still be useless to the agent. Trace-verified in our runs, a probe-healthy free model spammed forbidden tools, leaked raw `<|tool_call_id|>` framing tokens into its tool arguments, and burned a 240-second budget without ever reaching a verdict. Health and competence are different axes. Gate CI on health — is the pool up — but rank your candidate list by demonstrated competence — which model actually finishes the task. A model that flunks the task never earns the top slot no matter how green its probe.",
      },
      { kind: "h2", text: "The honest split" },
      {
        kind: "p",
        text: "This is CI reliability engineering, not a claim about model quality. None of it makes a weak model strong; it stops a busy free pool from being scored as a broken product. If you gate any pipeline on a live LLM provider: probe the real shape, read the body not the status, require consecutive greens, pair the gate with in-run backoff, walk a candidate list, and rank that list by competence — not by whichever model answered your ping first.",
      },
      {
        kind: "p",
        text: "(These probes guard the agent E2E suite for [nlqdb](https://nlqdb.com), the data layer you ask in English — we run the free-model chain in CI on purpose, so the harness has to tell a saturated pool apart from a real regression.)",
      },
    ],
  },
  {
    slug: "bird-gold-noise-distinct",
    title: "Your text-to-SQL model isn't as wrong as your benchmark says. The gold SQL is.",
    description:
      "We bucketed 238 BIRD-dev losses with a structural differ: 46 differ from gold only by a DISTINCT the model rightly added. Audit gold quality before writing prompt directives, or you overfit to noise.",
    date: "2026-07-06",
    body: [
      {
        kind: "p",
        text: "You run BIRD-dev, read an execution accuracy of 0.512, and the instinct is immediate: start writing planner directives to close the gap. We had the same instinct. Before acting on it we did one thing that changed the whole plan — we bucketed the losses. Not skimmed a few failures; tagged all 238 mismatches with a structural differ and counted what actually went wrong in each.",
      },
      { kind: "h2", text: "19% of our losses were one DISTINCT — added correctly" },
      {
        kind: "p",
        text: "The biggest bucket was startling: **46 of 238 mismatches (19%)** differ from the gold SQL only by a `DISTINCT` the model added and gold didn't. `COUNT(DISTINCT customer_id)` where gold wrote `COUNT(*)`. `SELECT DISTINCT x` where gold wrote a plain `SELECT x`. Read the pairs one by one and a large share of them are the model being *more* correct than the annotation.",
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- Question: how many patients had an abnormal lab result?\n-- Gold (BIRD annotation):\nSELECT COUNT(T1.ID)\nFROM Patient AS T1\nJOIN Laboratory AS T2 ON T1.ID = T2.ID\nWHERE T2.result = 'abnormal';\n-- one patient with 5 abnormal labs counts 5 times\n\n-- Model:\nSELECT COUNT(DISTINCT T1.ID)\nFROM Patient AS T1\nJOIN Laboratory AS T2 ON T1.ID = T2.ID\nWHERE T2.result = 'abnormal';\n-- counts patients — the thing the question asked for",
      },
      {
        kind: "p",
        text: "A patient-to-labs join is one-to-many. Counting *patients* after that join needs `COUNT(DISTINCT T1.ID)`; gold's bare `COUNT(T1.ID)` over-counts the fan-out. Execution accuracy compares result sets, gold's result set is wrong, so the scorer marks the model **wrong for being right**.",
      },
      { kind: "h2", text: "This is not one benchmark having a bad day" },
      {
        kind: "p",
        text: "Independent measurement backs the pattern. The Kang lab at UIUC audited BIRD and found **52.8% of instances carry annotation errors** ([VLDB 2026, arXiv:2601.08778](https://arxiv.org/abs/2601.08778)) — wrong gold SQL, ambiguous questions, schema mismatches — and released a corrected evaluation set. When half the answer key has errors, the number the leaderboard prints is not a measurement of your engine. It's a measurement of your engine *and* the answer key's noise, entangled.",
      },
      { kind: "h2", text: "The trap: optimizing into the noise" },
      {
        kind: "p",
        text: 'Here is why this matters beyond bruised pride. If you chase the biggest loss bucket with a prompt directive — *"avoid DISTINCT unless explicitly requested"* — the benchmark number goes up. You will feel good about it. And you will have taught your model to drop a `DISTINCT` it should keep, silently degrading real-world answers over one-to-many joins, which are everywhere. That is overfitting to wrong gold: trading production correctness for benchmark points.',
      },
      { kind: "h2", text: "The fix: classify your loss mass before touching the prompt" },
      {
        kind: "p",
        text: "The differ that buckets losses is about a hundred lines and needs no LLM — parse both queries, diff the structure, tag the difference class (`extra_DISTINCT`, extra column, wrong aggregate, wrong filter…), histogram the tags. Then apply one rule: **only write a directive for a bucket where gold is right and the model is wrong.**",
      },
      {
        kind: "p",
        text: "The same audit that disqualified the `DISTINCT` bucket qualified another: 7 losses where the model concatenated two requested columns into one (`first_name || ' ' || last_name`) against a gold that correctly returned two columns — 7 clean losses, zero gold-noise, and no winning query used the pattern. That bucket earned a directive, and re-scoring the de-concatenated predictions against the real databases confirmed it: wrong-to-right flips, zero regressions.",
      },
      { kind: "h2", text: "The rule" },
      {
        kind: "p",
        text: "**A benchmark number is a floor bounded by its gold quality, not a measure of your engine.** Before you optimize any metric, audit what it's actually counting — because past a point, the returns on prompt engineering aren't limited by your model. They're limited by the answer key.",
      },
      {
        kind: "p",
        text: "(This audit is standing practice for [nlqdb](https://nlqdb.com), the data layer you ask in English: every eval run's losses are bucketed structurally before any planner change ships, so the directives we write target real engine mistakes — not annotation noise.)",
      },
    ],
  },
  {
    slug: "llm-concatenates-columns-text-to-sql",
    title: "Your LLM fused the two columns you asked for — and the eval marked it wrong",
    description:
      "Gold SQL returns first_name, last_name as two columns; the model returns one concatenated full name. Positional-tuple EX scoring can never match them, so a semantically right answer scores as a miss.",
    date: "2026-07-06",
    body: [
      {
        kind: "p",
        text: "You ask a text-to-SQL model to \"list the members' names\". The benchmark's gold query returns `first_name, last_name` — two columns. The model returns one: a helpfully assembled full name. Read side by side, the model's answer is arguably the better one. The scorer marks it wrong, every single time, and your engine number reads lower than the engine is.",
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- gold: two columns\nSELECT first_name, last_name FROM member WHERE ...;\n\n-- model: one column, same information\nSELECT first_name || ' ' || last_name FROM member WHERE ...;",
      },
      { kind: "h2", text: "Why every execution-accuracy scorer does this" },
      {
        kind: "p",
        text: "Execution accuracy — the metric behind BIRD, Spider, and most private text-to-SQL evals — runs both queries and compares *positional value tuples*: canonical BIRD literally compares `set(fetchall())`. Column names are ignored on purpose (aliases shouldn't matter), which means the *shape* of each row is all that's left. A one-column result can never equal a two-column gold, no matter how right the content is.",
      },
      {
        kind: "p",
        text: 'This is the mirror image of the extra-columns failure everyone already knows about — where the model SELECTs a helpful extra field and the added column breaks tuple equality. Fusing two requested columns into one is exactly as fatal as adding one nobody asked for. The scorer has no notion of "close": the tuple matches or it doesn\'t.',
      },
      { kind: "h2", text: "The loss is real, measurable, and lopsided" },
      {
        kind: "p",
        text: "We bucketed a full 500-question BIRD-dev run of our free-lane engine with a structural differ before touching the prompt. The concatenation signature was unambiguous:",
      },
      {
        kind: "ul",
        items: [
          "**7 of 238 losses** concatenated columns where the gold query kept them separate.",
          "**0 of 256 wins** used `||` at all — the operator appeared only in losing answers.",
          "Gold itself used `||` in **1 of 500** questions.",
        ],
      },
      {
        kind: "p",
        text: "That last line is the decision. When a construct shows up in 3% of your losses, none of your wins, and almost none of the gold answers, discouraging it is near-pure upside — there is essentially nothing on the other side of the trade to regress.",
      },
      { kind: "h2", text: "The fix is one sentence in the planner prompt" },
      {
        kind: "p",
        text: "No fine-tune, no reranker: one projection directive — *return each requested attribute as its own column unless the question explicitly asks for a single combined string*. Before shipping it we de-concatenated the 7 flagged predictions by hand and re-executed them against the real SQLite databases to get a deterministic ceiling: **+3 questions** flip wrong-to-right, zero regressions. The live re-measure confirmed the direction: run-wide `||` concatenations dropped from 7 to 3, and 2 of the 3 ceiling questions flipped to matches.",
      },
      {
        kind: "p",
        text: "The general method matters more than this one directive: bucket your loss mass with a structural differ *first*, compute the deterministic ceiling of a candidate fix *second*, and only then edit the prompt. Prompt directives written from vibes overfit; directives written from a 7-losses/0-wins histogram are as close to a free lunch as engine work gets.",
      },
      { kind: "h2", text: "The rule" },
      {
        kind: "p",
        text: "The model's job is to match the shape of the answer, not to make it pretty. A helpful concatenation is still a wrong result set — and unless you bucket your losses, you'll never notice that some of your \"wrong\" answers were the model being more helpful than your gold.",
      },
      {
        kind: "p",
        text: "(This directive now ships in [nlqdb](https://nlqdb.com), the data layer you ask in English. The eval harness that found it — structural mismatch classifier, deterministic-ceiling re-scorer — runs against public BIRD/Spider plus our own ICP-shaped persona benchmark, so prompt changes land with a measured delta, not a hunch.)",
      },
    ],
  },
  {
    slug: "http-200-error-in-body",
    title:
      "Your text-to-SQL eval is lying: the gateway returns HTTP 200 with the error in the body",
    description:
      "A gateway commits 200 OK before the upstream model fails, so the error rides in the 200 body. A res.ok-only client counts it as a wrong answer, not an outage. res.ok is necessary, not sufficient.",
    date: "2026-07-05",
    body: [
      {
        kind: "p",
        text: "We were reading a text-to-SQL benchmark score that looked too low. Seven questions per 150-question run came back tagged `no_sql` — the model, we thought, had simply failed to produce a query. On a frontier lane that is a jarring number. So we opened the raw responses, and the model had failed to produce *nothing*. The HTTP status was `200 OK`. The body was an error.",
      },
      { kind: "h2", text: "A 200 is a promise the gateway makes before it knows the answer" },
      {
        kind: "p",
        text: "This is a property of gateways, not a bug in one vendor. When you call an LLM through an aggregator like OpenRouter, two machines are involved: the gateway you connect to, and the upstream provider it routes your request to. The gateway has to decide its HTTP status *when it starts streaming a response to you* — and at that moment the upstream request may still be in flight. So it commits to `200 OK`, opens the stream, and then the upstream call rate-limits, times out, or errors. The status line already went out. The only place left to report the failure is the response body.",
      },
      {
        kind: "p",
        text: "OpenRouter documents exactly this: an error can arrive with a `200` status and a top-level `error` object *instead of* `choices` ([errors reference](https://openrouter.ai/docs/api/reference/errors-and-debugging)). The shape looks like a normal completion envelope right up until you go looking for the content that isn't there.",
      },
      {
        kind: "code",
        lang: "json",
        code: '// HTTP/1.1 200 OK  ← the status lies\n{\n  "error": {\n    "code": 429,\n    "message": "Provider returned error",\n    "metadata": { "provider_name": "..." }\n  }\n}\n// no "choices" — the completion never happened',
      },
      { kind: "h2", text: "Why res.ok quietly corrupts an eval" },
      {
        kind: "p",
        text: 'The natural client is a two-branch one: if `res.ok`, parse the completion; otherwise, it\'s an infrastructure error — pause, back off, retry. That branch is where the damage happens. A `200` with an error body takes the *success* branch. Your parser reaches for `choices[0].message.content`, finds nothing, and hands back an empty string. Downstream, an empty completion is indistinguishable from "the model answered but produced no SQL" — so it gets scored as a **wrong answer**.',
      },
      {
        kind: "p",
        text: "That single misclassification does two bad things to a benchmark. It undercounts your engine's true accuracy — the model was never given a chance to answer, yet it eats the loss. And it hides a real capacity problem — those seven failures were rate-limits the harness should have paused and retried, not quality losses to investigate. You end up staring at planner prompts trying to fix an accuracy gap that is actually an outage in disguise.",
      },
      { kind: "h2", text: "The fix: res.ok is necessary, not sufficient" },
      {
        kind: "p",
        text: "Inspect the body for a top-level `error` before you trust the `choices`. A response is only a real completion if the transport succeeded *and* the payload carries content. Everything else is infrastructure — classify it as such so your retry logic and your metrics both see it correctly.",
      },
      {
        kind: "code",
        lang: "ts",
        code: 'const body = await res.json();\n\n// A 200 is not enough — the error can ride inside it.\nif (!res.ok || body?.error) {\n  const status = body?.error?.code ?? res.status;\n  // 429 → capacity: pause + retry, don\'t score it\n  // 5xx → provider error: retryable, still not a quality loss\n  throw new UpstreamError(status, body?.error?.message);\n}\n\nconst sql = body.choices?.[0]?.message?.content;\nif (!sql) throw new UpstreamError(200, "empty completion");',
      },
      {
        kind: "p",
        text: 'In our own eval harness this was a seven-line change to the response classifier, and it moved the frontier lane\'s ceiling immediately: seven `no_sql` "losses" per 150-question run reclassified from *engine failure* to *capacity pause*, which the tail-retry already covers. The accuracy number stopped lying, and the retry logic started catching the failures it was written for.',
      },
      { kind: "h2", text: "The general rule" },
      {
        kind: "p",
        text: "Any time you talk to a model through a gateway — an aggregator, a proxy, a load balancer, your own edge worker — the HTTP status describes the *hop you completed*, not the *work you asked for*. The two can disagree, and they disagree exactly when things are going wrong, which is the worst time to be blind. Read the body before you believe the status. If you're building an eval or an agent on top of a routed LLM, this one check is the difference between a metric you can trust and a metric that flatters your infrastructure by blaming your model.",
      },
      {
        kind: "p",
        text: "(This is one of the classifier rules behind [nlqdb](https://nlqdb.com), the data layer you ask in English: a rate-limited upstream is paused and retried, not counted as a query the engine couldn't answer — so the accuracy we report is the engine's, not the gateway's.)",
      },
    ],
  },
  {
    slug: "top-n-rows-per-group",
    title: "Top N per group is the query `LIMIT` can't write",
    description:
      '"Top 3 per category" reads like ORDER BY … LIMIT 3, but LIMIT caps the whole result set, not each group. The fix is ROW_NUMBER() OVER (PARTITION BY …) — and the hidden decision is how ties break.',
    date: "2026-07-04",
    anchor: {
      label: "Find the top N rows per group — the full guide",
      path: "/solve/find-top-n-rows-per-group",
    },
    body: [
      {
        kind: "p",
        text: 'You want the top 3 best-selling products *in each category*. Or the most recent order *per customer*. Or the highest-scoring attempt *per user*. The English is so plain it feels like it should compile to something you already know — `ORDER BY revenue DESC LIMIT 3` — and that is exactly the trap. `LIMIT` caps the *whole result set*. Ask it for the top 3 and it hands you the 3 best rows across every category combined, not 3 per category. The word "per" quietly moved the query somewhere `LIMIT` cannot follow.',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- What you wrote (wrong): 3 rows total, not 3 per category\nSELECT category, name, revenue\nFROM products\nORDER BY revenue DESC\nLIMIT 3;",
      },
      { kind: "h2", text: '"Per group" is a partition, not a limit' },
      {
        kind: "p",
        text: 'This is the classic "greatest-N-per-group" problem, and the reason it gets re-Googled every time is that the correct shape looks nothing like the question. You are not limiting rows — you are *ranking within each group and keeping the top of each rank*. That is a window function: number the rows inside each partition, then filter to the rank you want.',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- Rank inside each category, then keep the top 3 of each\nSELECT category, name, revenue\nFROM (\n  SELECT category, name, revenue,\n         ROW_NUMBER() OVER (\n           PARTITION BY category\n           ORDER BY revenue DESC\n         ) AS rn\n  FROM products\n) t\nWHERE rn <= 3;",
      },
      {
        kind: "p",
        text: 'The `PARTITION BY` is the "per category" the English asked for; the `ORDER BY` inside the window is the "best-selling"; the outer `WHERE rn <= 3` is the "top 3." You cannot filter on `rn` in the same SELECT that computes it — window functions are evaluated after `WHERE` — so it has to be a subquery (or a CTE). That structural jump, from a flat query to a nested ranked one, is the whole difficulty. Nothing here is hard; it just doesn\'t resemble the sentence you started with.',
      },
      { kind: "h2", text: 'The decision hiding in "top 3": what happens to ties' },
      {
        kind: "p",
        text: 'There is a second choice buried in that query, and it is the one that bites in production. If two products tie for third place by revenue, do you want exactly 3 rows, or all the rows tied at rank 3? `ROW_NUMBER()` breaks ties arbitrarily and gives you exactly 3 — but which of the tied rows it drops is undefined unless your `ORDER BY` is fully deterministic. `RANK()` keeps every tied row (so "top 3" might return 4). `DENSE_RANK()` keeps ties but doesn\'t skip rank numbers. Same English, three different answers, and the query never tells you which one you picked — you have to have decided.',
      },
      {
        kind: "ul",
        items: [
          "`ROW_NUMBER()` — **exactly N rows** per group; ties broken by the `ORDER BY` (add a tiebreak column, or the drop is nondeterministic).",
          "`RANK()` — **every tied row** at the cutoff is included, and rank numbers skip after a tie (1, 2, 2, 4).",
          "`DENSE_RANK()` — **ties included, no gaps** in the numbering (1, 2, 2, 3).",
        ],
      },
      { kind: "h2", text: "Ask in English — then read the SQL it ran" },
      {
        kind: "p",
        text: 'This is a good case for asking in plain English and *reading the query back*, precisely because the failure mode is silent: the wrong-`LIMIT` version runs fine and returns rows — just the wrong ones — and the tie behaviour never announces itself. "Top 3 products per category by revenue" should hand you back both the ranked rows and the `ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC)` it compiled, so you can confirm it partitioned by the column you meant and see how ties resolve before you trust the numbers in a deck.',
      },
      {
        kind: "p",
        text: "(That is the half we built [nlqdb](https://nlqdb.com) for: ask the top-N question in English over a Postgres it provisions, or one you already run via a signed-in connect, and get the ranked rows plus the compiled window-function SQL. Honest split — it returns a read-only ranked answer, not a live leaderboard that updates on its own; and if you want ties included, say so and it switches `ROW_NUMBER` to `RANK` or `DENSE_RANK`.)",
      },
      {
        kind: "p",
        text: 'The general lesson: when a question says "per" or "in each," the grain moved from the result set to a group inside it, and set-level tools like `LIMIT` stop applying. Reach for a window function — and decide the tie rule on purpose, because the query will pick one for you whether or not you meant to.',
      },
    ],
  },
  {
    slug: "your-bi-tool-got-acquired-data-layer",
    title: "Your BI tool got acquired. Your data layer shouldn't have to care.",
    description:
      "BI notebooks get rolled up — Mode → ThoughtSpot, Looker → Google, Periscope → Sisense. Fine when it's a destination humans log into; a liability when your product's runtime calls its API.",
    date: "2026-07-04",
    anchor: {
      label: "nlqdb vs Mode — the full side-by-side",
      path: "/vs/mode",
    },
    body: [
      {
        kind: "p",
        text: "The analytics-notebook category is a roll-up. Mode went to ThoughtSpot in 2023 for a reported $200M. Looker went to Google. Periscope Data went to Sisense. This is normal — good analytics companies get bought, and the tool keeps working the morning after. The question that decides whether the acquisition is *news* or a *problem* for you is where you put the tool: a place your people log into, or a dependency inside your product's runtime.",
      },
      { kind: "h2", text: "A destination survives an acquisition. A dependency inherits it." },
      {
        kind: "p",
        text: "When a BI tool is a **destination** — a workspace analysts open to write SQL, build a notebook, publish a dashboard — an acquisition is somebody else's roadmap. You get a new login screen, an eventual migration email, maybe a repriced tier. Annoying, bounded, and it happens on your analysts' time, not your users'. The tool is where humans go to look; the acquirer changing it is a thing humans notice and adapt to.",
      },
      {
        kind: "p",
        text: "When that same tool is a **dependency** — you wired its API, its embed, or its AI endpoint into the thing your product does at runtime — the acquisition is now your roadmap too. Whatever the buyer decides about that API's shape, its pricing, its rate limits, and especially its AI direction, your runtime inherits. Mode is a clean example: post-acquisition its AI arrives as ThoughtSpot Sage — LLM search over Mode Datasets, aimed at analysts. That's a reasonable direction for a destination analytics suite. It is a *different* direction than pre-acquisition Mode, and if your product had leaned on Mode's AI answering a specific way, the acquisition rewrote that for you, on the acquirer's schedule.",
      },
      { kind: "h2", text: "Two altitudes: where humans look vs. what your software calls" },
      {
        kind: "p",
        text: "The split worth naming is altitude, not vendor. A **destination analytics app** is a SQL IDE plus notebooks plus shareable reports — a surface an analyst drives to explore and publish. A **runtime data layer** is the thing your product or agent calls per request to turn a question into an answer, unattended, in the hot path. The first is where humans look; the second is what your software calls. A destination can be acquired and rebranded and your users never feel it; a runtime dependency's ownership *is* felt, because it's on the critical path of a request your app is making right now.",
      },
      {
        kind: "p",
        text: "So the durable move isn't \"pick the vendor least likely to be acquired\" — you can't predict that, and the good ones get bought. It's to keep the acquisition-exposed thing at the altitude where an acquisition is bounded. Use the destination as a destination. If a capability has to live in your runtime, own that layer or buy it from something whose entire contract *is* the runtime call — English in, compiled SQL and typed rows out — so there's no notebook, embed surface, or analyst-facing AI story for an acquirer to redirect underneath you.",
      },
      {
        kind: "p",
        text: "(That runtime layer is what [nlqdb](https://nlqdb.com) is: ask in English over a Postgres it provisions, or one you already run via a signed-in connect, and get the compiled SQL plus typed rows back over an SDK, an HTML element, or MCP. Honest caveat — it is *not* a notebook or a BI suite. For collaborative SQL, Python/R cells, charts, and shareable dashboards, a Mode or a Hex is the right tool, and the two compose cleanly: the notebook is where your analysts explore, nlqdb is the data layer your product calls at runtime.)",
      },
      {
        kind: "p",
        text: "The general lesson: an acquisition doesn't break a tool — it transfers the roadmap. Whether that matters to you is a function of altitude. Anything a human logs into can change hands quietly; anything your runtime calls should be owned, or bought as a runtime, so a deal you didn't sign can't rewrite a request your product is already making.",
      },
    ],
  },
  {
    slug: "find-duplicate-rows-you-re-google-every-time",
    title: "The duplicate-rows query you re-Google every six weeks",
    description:
      "Find duplicates hasn't changed in thirty years: GROUP BY the suspect columns, HAVING COUNT(*) > 1. Wanting the whole row, not just the key, quietly changes it to a window function.",
    date: "2026-07-03",
    anchor: {
      label: "Find duplicate rows in my data — the full guide",
      path: "/solve/find-duplicate-rows-in-my-data",
    },
    body: [
      {
        kind: "p",
        text: "There is a query nobody memorises and everybody needs: find the rows that are duplicated. A customer signed up twice, an import ran twice, a join fanned out and doubled every row. The answer has been the same for thirty years — `GROUP BY` the suspect columns, `HAVING COUNT(*) > 1` — and yet if you are not writing SQL daily you look it up *every single time*, because the shape is just unusual enough to not stick.",
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- Which emails appear more than once?\nSELECT email, COUNT(*) AS n\nFROM customers\nGROUP BY email\nHAVING COUNT(*) > 1;",
      },
      { kind: "h2", text: "The trap is not difficulty — it is that the shape changes under you" },
      {
        kind: "p",
        text: 'It bites in quiet ways. Group by the wrong columns and you under- or over-count — the grain of the query *is* the definition of "duplicate," and it is easy to pick the wrong one. And the moment you want the *whole duplicate row* rather than just the duplicated key, the query you Googled stops being the query you need. `GROUP BY` collapses each group to one summary row; to keep every offending row you reach for a window function instead:',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- Keep the full rows, tag the extras\nSELECT *\nFROM (\n  SELECT *,\n         ROW_NUMBER() OVER (\n           PARTITION BY email\n           ORDER BY created_at\n         ) AS rn\n  FROM customers\n) t\nWHERE rn > 1;",
      },
      {
        kind: "p",
        text: 'Same question — "where are my duplicates?" — two structurally different queries, and which one you want depends on whether you need the *count* or the *rows*. It is a yes/no question wearing a SQL costume, and the costume changes every time.',
      },
      { kind: "h2", text: "Ask in English — then read the SQL it ran" },
      {
        kind: "p",
        text: 'This is exactly the case for asking in plain English and *reading the SQL it generates*. Not because SQL is beneath you — because the grain matters here and you want to verify it. "Which customers appear more than once by email?" should hand you back both the rows and the `GROUP BY email HAVING COUNT(*) > 1` it ran, so you can confirm it grouped on the column you meant before you trust the count. A chat model can write you that query; it cannot run it against your data, and if you paste rows into a prompt and ask it to count, it will confidently hallucinate the tally.',
      },
      {
        kind: "p",
        text: "(That is the half we built [nlqdb](https://nlqdb.com) for: ask the duplicate question in English over a Postgres it provisions, or one you already run via a signed-in connect, and get the rows plus the compiled SQL. Honest split — it *reports* duplicates with a read-only query; which row to keep and how to merge is a write you run deliberately, and matching is exact, not fuzzy.)",
      },
    ],
  },
  {
    slug: "text-to-sql-build-vs-buy",
    title: "The text-to-SQL demo takes an afternoon. The other 90% is why you should buy it.",
    description:
      "Prompt + model + run the SQL is 10% of an 'ask your data' feature. The fail-closed validator, plan cache, and eval harness are the rest — yours forever. The real question: do you want that stack?",
    date: "2026-07-03",
    anchor: {
      label: "Add 'ask your data' without building text-to-SQL — the full guide",
      path: "/solve/add-ask-your-data-feature-without-building-text-to-sql",
    },
    body: [
      {
        kind: "p",
        text: "The demo really is an afternoon. Pull the table definitions out of `information_schema`, template them into a prompt with the user's question, call a model, run whatever SQL comes back, render the rows. Every stack has a tutorial for this now, and they all work — \"let our users ask their data in English\" goes from ticket to working prototype before the day ends. That's the 10%.",
      },
      { kind: "h2", text: "The other 90% shows up after the first real user" },
      {
        kind: "p",
        text: "The prototype's job was to produce SQL. The feature's job is to run model-authored SQL against your production database, on your users' behalf, unattended. Those are different jobs, and the gap between them is a stack of infrastructure the tutorial never mentions:",
      },
      {
        kind: "ul",
        items: [
          "**A validator that fails closed.** The model will eventually emit a write — a `DELETE` inside a CTE, a `DROP` behind a comment, a join onto a table the asker should never see. You need a parser-level allow-list that rejects everything except the reads you meant to permit, and rejects anything it can't parse. A regex denylist is the bug report you haven't received yet.",
          "**A plan cache keyed on question + schema version.** The same question shouldn't cost a model call twice, so you cache compiled plans — but a cached plan is only valid until the schema moves, so the key has to carry a schema fingerprint and invalidation becomes your problem. Skip this and every dashboard load bills you fresh tokens at p95 model latency.",
          "**An eval harness over a labelled set.** Prompts get edited, models get swapped or silently updated, and NL→SQL accuracy moves when either happens. Without a scored question→gold-answer set you find the regression when a customer does. Building the harness is a project; keeping the labelled set honest as your schema evolves is a chore with no finish line.",
        ],
      },
      {
        kind: "p",
        text: "None of this is exotic — every piece is buildable. The catch is that every piece is *maintainable*: production infrastructure with your on-call rotation's name on it, in service of a feature that probably isn't your product.",
      },
      { kind: "h2", text: "The honest build-vs-buy test" },
      {
        kind: "p",
        text: "The wrong question is \"can I generate SQL from English?\" Yes — in an afternoon, that's the point. The right question is \"do I want to own that stack?\" If natural-language querying *is* your product — you're building a BI tool, a data platform, an agent framework — own it; the validator and the eval harness are your moat. If it's a reporting tab, a search box over each user's own rows, an in-app assistant — a feature inside a product that's about something else — buy the pipeline and embed it, the way you'd buy auth or email instead of running an SMTP server.",
      },
      {
        kind: "p",
        text: "(That second case is the one [nlqdb](https://nlqdb.com) exists for: drop in one element or one `POST /v1/ask`, the English compiles against the live schema, the compiled SQL is shown before anyone trusts it, reads pass a fail-closed allow-list, and the validator/cache/eval stack is our maintenance burden instead of yours. Honest limits: it's a hosted pipeline you embed, not a library you vendor — and \"many users over their own rows\" still means a database or an isolation scope per tenant, because per-user row-level security inside one shared database isn't shipped.)",
      },
      {
        kind: "p",
        text: "The general lesson: a demo prices the first afternoon; a feature prices the years after it. When an AI capability collapses the demo cost to nearly zero — and text-to-SQL has — the build-vs-buy decision doesn't disappear. It just moves to the part of the stack the demo never showed you.",
      },
    ],
  },
  {
    slug: "sitemap-advertising-redirects",
    title: "Your sitemap is advertising redirects — and your canonical tag points at one",
    description:
      "A static host that serves route/index.html 307-redirects the bare path. Our sitemap advertised 27 redirecting URLs and every canonical tag pointed at one. The fix is one path-normalize helper.",
    date: "2026-07-03",
    body: [
      {
        kind: "p",
        text: "Run `curl -sI` over the URLs in your own sitemap. We did, and 27 of ours answered **307 Temporary Redirect** — every route on the site. The canonical tag was worse: each page declared a canonical URL that redirected to the page itself. We were telling crawlers, on every single page, that the authoritative copy lives one hop away.",
      },
      { kind: "h2", text: "How a static host quietly forks every URL in two" },
      {
        kind: "p",
        text: "The mechanics are mundane, which is why this survives review. A static build writes each route as `route/index.html`. The host serves `/route/` directly — and answers the bare `/route` with a 307 to the slash form. So every route on the site has two URLs: one real, one a redirect. Which one your HTML advertises depends on whoever typed the link.",
      },
      {
        kind: "p",
        text: "Our templates typed the bare form everywhere it matters most: the `canonical` tag, `og:url`, the sitemap generator, and `llms.txt` — the four surfaces whose entire job is to name the authoritative URL. All four advertised the redirect.",
      },
      { kind: "h2", text: "Why a self-referential redirecting canonical is worth fixing" },
      {
        kind: "ul",
        items: [
          "**A canonical pointing at a redirect is a mixed signal.** The tag exists to end URL ambiguity; making crawlers resolve a hop to find the 'canonical' copy reintroduces exactly the ambiguity it was meant to close.",
          "**Sitemap URLs are supposed to be final.** Search engines tolerate redirects there, but every hop is a chance for a URL to get indexed in the form you didn't pick — and split whatever authority the page earns across two spellings.",
          "**AI crawlers fetch exactly what you wrote.** `llms.txt` consumers and answer-engine bots are literal; an extra 307 on every fetch is latency you chose, on the surface built for machines.",
        ],
      },
      { kind: "h2", text: "The fix is a policy plus one helper, not a link hunt" },
      {
        kind: "p",
        text: 'Chasing individual links is the wrong altitude. The durable fix was three moves: pick the slash form as policy (`trailingSlash: "always"`, so the build itself rejects the other spelling); route every emitted URL — canonical, `og:url`, sitemap, `llms.txt` — through one path-normalize helper in the head layout and URL generators; and re-audit with `curl -sI` over every sitemap URL, expecting nothing but 200s.',
      },
      {
        kind: "p",
        text: "The one-helper rule is what made the follow-up cheap: once advertised URLs were normalized in one place, sweeping the remaining 1,100+ bare-path hrefs inside page bodies was a mechanical pass, and a link check in the build now fails on any regression. ([nlqdb](https://nlqdb.com) is the database you talk to; this is one of the engineering notes from building it in the open.)",
      },
      {
        kind: "p",
        text: "The general lesson: every surface that names a URL — canonical, `og:url`, sitemap, `llms.txt`, internal hrefs — should call the same normalize function. If two of them can disagree about your own address, they eventually will, and you'll advertise the disagreement to every crawler that visits.",
      },
    ],
  },
  {
    slug: "offline-llm-eval-rate-limits",
    title: "Your offline LLM eval isn't measuring your model — it's measuring your rate limits",
    description:
      "A free-model NL-to-SQL bench scored 17/20, then 6/20 ninety seconds later. The model didn't change — the providers got tired. How to keep availability out of your accuracy number.",
    date: "2026-07-03",
    body: [
      {
        kind: "p",
        text: "Our small NL-to-SQL benchmark — twenty questions, one gold query each, scored by executing the SQL and comparing result sets — came back **17/20** on a greedy pass. An immediate second run on the same commit, drawing three samples per question instead of one, came back **6/20**, with 14 of the 20 questions returning no SQL at all. Ninety seconds apart, same engine, same prompts, an eleven-answer collapse.",
      },
      {
        kind: "p",
        text: "Nothing regressed. The engine behind [nlqdb](https://nlqdb.com) runs on a chain of free-tier LLM providers, and the second run tripled the request volume the first run had already spent. The providers got tired. The score didn't measure the model's reasoning — it measured the moment the free quota ran out.",
      },
      { kind: "h2", text: "The failure signature: instant, empty, off the books" },
      {
        kind: "p",
        text: "The tell is in the error tally, not the score. Those 14 no-SQL answers were `circuit_open` fast-fails: an earlier 429 had opened the provider's circuit breaker for its `Retry-After` window, so the call failed before any tokens were generated — the p50 latency of a failing question was ~0 ms. A model that reasons badly takes seconds to be wrong; a rate limit is wrong instantly. When your failures are instant, you are measuring availability, not accuracy.",
      },
      {
        kind: "p",
        text: "On a multi-provider chain the collapse compounds: the 429 opens one breaker, the chain falls through to the next provider (also cooling down), and within a few questions every attempt fails without reaching a model. We hit the same wall at scale — our first full 500-question BIRD dispatch scored a dismal 0.214, and 246 of its 283 no-SQL failures were breaker fast-fails. We discarded the number. It measured the wall, not the engine.",
      },
      { kind: "h2", text: "Three rules that keep availability out of the accuracy number" },
      {
        kind: "ul",
        items: [
          "**Throttle to measure reasoning.** Spacing questions ~4 s apart keeps the run inside the free tiers' request rates. Our first clean throttled pass scored 21/23 — consistent with the healthy 17/20, nowhere near the starved 6/20. Slower, but the number means what it claims to mean.",
          "**Budget-stop and resume; don't push through.** When every attempt in a stretch fails with `rate_limited` or `circuit_open` after one bounded capacity wait, stop scoring and write a checkpoint keyed on the commit SHA. A full 500-question pass now runs as a handful of ~15-minute windows resumed across the day, instead of one starved marathon that scores the outage.",
          "**Keep the smoke test away from the powered run.** The quick greedy smoke and the windowed canonical run drain the same shared quota; back-to-back, the second one measures the first one's exhaust. Anything else that borrows the free chain — for us, an e2e suite whose driver is an LLM — belongs on a different day than a full eval.",
        ],
      },
      {
        kind: "p",
        text: "The general lesson: if a benchmark number moves more between 9:00 and 9:02 than it does between two commits, read the error tally before the diff. An execution-accuracy score is only meaningful over questions that actually reached a model, so report attempted-versus-total next to the headline number — and treat instant failures as a capacity problem to engineer around (throttles, breakers, resumable windows), not a reasoning regression to bisect.",
      },
    ],
  },
  {
    slug: "ai-internal-tool-builder-faster",
    title: "AI made the internal-tool builder faster. It didn't ask whether you needed the tool.",
    description:
      "Low-code AI scaffolds the admin tool in a prompt. But the output is still a destination a human operates — and often the answer belongs inline in your product, or the asker is an agent.",
    date: "2026-07-03",
    anchor: {
      label: "nlqdb vs Retool — the full side-by-side",
      path: "/vs/retool",
    },
    body: [
      {
        kind: "p",
        text: "Every low-code platform now has an AI layer. Describe the app, it scaffolds the screens against your schema. Ask in English, it writes the SQL. Point an agent at it and it plans, calls tools, and queries your data with guardrails. This is real and it's good — the thing that used to take an afternoon of dragging components and wiring queries takes a prompt.",
      },
      { kind: "h2", text: "What got faster is building the tool" },
      {
        kind: "p",
        text: 'But notice what got faster: *building the tool*. The output is still a destination — an internal app a human opens, logs into, and reads. AI shortened the path from "I need a dashboard" to "I have a dashboard." It didn\'t question the premise that the answer to a data question is a dashboard you build.',
      },
      {
        kind: "p",
        text: "A lot of the time it isn't. The data question lives *inside* a product you're already shipping — \"show this customer their last five orders,\" \"what did this account spend this quarter\" — and the honest deliverable isn't a separate admin app, it's an answer rendered inline, on the page the user is already on. Or the asker isn't a human at all: it's an agent that needs to provision a database, write to it, and query it programmatically on every request, with no UI in the loop ever. Neither of those wants a built tool. They want a backend primitive.",
      },
      { kind: "h2", text: "Builder or backend primitive" },
      {
        kind: "p",
        text: "That's the fork. A builder — even an AI-supercharged one — assumes a human will assemble and operate the result. A backend primitive assumes nobody will: you embed one element or call one API, pass an English goal, and get typed rows back. (At [nlqdb](https://nlqdb.com) we took the second side on purpose — English compiles to SQL over a Postgres the product or agent *provisions and owns*, writes diff-previewed, no app to assemble first — which is exactly why we don't ship a drag-drop canvas. Different job.) The builder wins when the deliverable genuinely is a standalone tool a team will run; the primitive wins when the answer belongs in the product, or the asker is code.",
      },
      {
        kind: "p",
        text: "Lesson: when an AI feature makes an old workflow 10× faster, check whether it made the *workflow* faster or the *outcome* faster. Scaffolding an internal tool faster is a real win — but if what you actually needed was the answer in your own app, or a database your agent stands up itself, the fastest builder is still building something you didn't need.",
      },
    ],
  },
  {
    slug: "text-to-sql-accuracy-schemas-your-users-never-build",
    title: "Your text-to-SQL accuracy is measured on schemas your users will never build",
    description:
      "BIRD and Spider score NL-to-SQL over messy academic schemas. The same free-model chain that scores 0.52 on BIRD scores 0.96 on the schema shapes our users actually build — so we report both.",
    date: "2026-07-02",
    body: [
      {
        kind: "p",
        text: "Every text-to-SQL engine publishes the same two numbers: BIRD and Spider. Ours are not flattering — the strict-$0 free-model chain behind nlqdb currently scores **0.52** on BIRD Mini-Dev and **0.19** on the Spider 2.0-lite SQLite subset. We track both weekly, against a pinned baseline, with a paired significance test, because those benchmarks are the honesty instrument of this field: hard, public, and comparable to every research paper.",
      },
      {
        kind: "p",
        text: "But look at what they actually measure. BIRD's databases are real-world dumps — dozens of tables, cryptic column names, dirty values, questions that hinge on external knowledge notes. Spider 2.0 is enterprise-analytics scale on purpose; its authors built it because models had gotten too good at the small clean stuff. Both are the right kind of hard for a research leaderboard. Neither looks anything like the database a user of a product like ours ever touches.",
      },
      { kind: "h2", text: "The schema your users build is the one you never scored" },
      {
        kind: "p",
        text: "Our users describe a goal in plain English and get a small, freshly-provisioned Postgres: a form-submissions table, a four-table agent-memory schema, a webhook event log. Five tables, honest column names, no fifteen-year accretion of legacy views. That shape — the one 100% of production queries actually run against — had zero rows in either benchmark. Which means the headline accuracy number described a workload we don't serve, in both directions: it undercounts what users experience, and it can hide regressions on the queries they really ask.",
      },
      { kind: "h2", text: "persona-bench: gold queries over the ICP shape, same scorer" },
      {
        kind: "p",
        text: "So we added a third benchmark and open-sourced it into the repo: **persona-bench**, 23 hand-authored question/gold-SQL pairs over the two schema shapes our personas actually build (a SaaS app DB and the agent-memory preset). Three rules kept it honest:",
      },
      {
        kind: "ul",
        items: [
          "**Same execution-accuracy scorer as BIRD/Spider.** A result-set match against gold, not an LLM judge — the number is comparable across all three datasets.",
          "**Gold is literal-date, never relative.** No `now()` in gold SQL, so a question's answer never drifts with the clock and a run today reproduces a run in March.",
          "**A gold-executability invariant runs first.** Every gold query must execute against the fixture and return non-degenerate rows before any model is scored. A benchmark with broken gold measures nothing — the ruler gets checked before the thing it measures.",
        ],
      },
      {
        kind: "p",
        text: "The result: the same free chain that scores 0.52 on BIRD and 0.19 on Spider scores **0.96 (22/23)** on persona-bench. That is not a brag — small clean schemas are exactly where NL-to-SQL is easy, which is the point: the difficulty distribution of a benchmark is a product decision, and defaulting to the academic one silently pins your roadmap to someone else's workload. The one persona-bench miss told us more about our planner than fifty BIRD misses over schemas we will never host.",
      },
      { kind: "h2", text: "Keep both numbers" },
      {
        kind: "p",
        text: "The failure mode to avoid is swapping the hard public benchmark for your flattering private one. We report all three: BIRD and Spider for comparability and as the hard floor that keeps us honest, persona-bench for the workload users hit. Two caveats we attach every time: 23 questions is small — one flipped answer moves the score about 4 points — and a benchmark you author yourself has an obvious conflict of interest, which the executability invariant and publishing the fixture mitigate but do not remove.",
      },
      {
        kind: "p",
        text: "If you ship an NL-to-data feature, the take-away is one afternoon of work: write twenty gold queries over the schema shape your users actually have, score them with the same execution-accuracy check the papers use, and run it beside the public benchmarks — not instead of them. ([nlqdb](https://nlqdb.com) is the database you talk to; the harness, fixture, and all three scores live in the open repo.)",
      },
    ],
  },
  {
    slug: "mcp-server-what-does-the-agent-own",
    title:
      "Every data tool shipped an MCP server this year. Your agent still can't build on most of them.",
    description:
      "Two shapes of MCP server look identical in a feature matrix: a window into a human's app, or infrastructure the agent owns. The tell is what the agent owns after the call returns.",
    date: "2026-07-02",
    anchor: {
      label: "nlqdb vs Hex — the full side-by-side",
      path: "/vs/hex",
    },
    body: [
      {
        kind: "p",
        text: 'MCP is the new "we have an API." Writing a competitor comparison recently, I went to mark "agent-callable" as our differentiator against an AI data-notebook tool — and stopped, because they\'d shipped an MCP server too. So had the BI tool two rows up. The honest move was to concede the checkbox. But conceding it surfaced the real axis, and it\'s one worth naming.',
      },
      { kind: "h2", text: "Two shapes of MCP server" },
      {
        kind: "p",
        text: 'There are two shapes of MCP server, and they look identical in a feature matrix. The first wraps a **destination app**: "ask my published notebook a question," "answer from my dashboard in Slack." The human\'s workflow, now reachable by an agent. The second exposes **infrastructure the agent owns**: provision a database, write rows, query them, migrate the schema. Both speak MCP. Only the second lets an agent build something that outlives the conversation.',
      },
      {
        kind: "p",
        text: "The tell is to ask what the agent *owns* after the call returns. If the answer is \"a view into a human's analysis,\" that's a genuinely useful human-in-the-loop surface — and a dead end for an autonomous agent, because the agent can read but can't accumulate. It has nowhere to put the row it just computed. An agent that can query but not persist is a calculator, not a coworker.",
      },
      { kind: "h2", text: '"Does it have MCP" is the wrong question' },
      {
        kind: "p",
        text: "So the question to ask a tool's MCP server isn't \"does it exist\" — by 2026 it always does. It's **\"what does it let the agent own?\"** Read-only over someone else's app, or a substrate the agent can write to and come back to. The matrix can't tell them apart; you have to read what the verbs actually do.",
      },
      {
        kind: "p",
        text: "(At [nlqdb](https://nlqdb.com) the MCP verb `nlqdb_query` materialises a Postgres on first reference — omit the database id with none provisioned and it creates one from the goal, so the agent gets a database it owns, not a window into ours. The comparison that prompted this is at [nlqdb vs Hex](/vs/hex/).)",
      },
    ],
  },
  {
    slug: "agent-memory-vector-store-aggregation-gap",
    title: 'Your agent\'s memory is a vector store. Ask it "how many" and watch it fall over.',
    description:
      "A vector store returns the top-k most similar memories — there is no GROUP BY, COUNT, or JOIN. Recall is similarity; reporting is aggregation. Agent memory needs both machines, not one.",
    date: "2026-07-02",
    anchor: {
      label: "nlqdb vs Pinecone — the full side-by-side",
      path: "/vs/pinecone",
    },
    body: [
      {
        kind: "p",
        text: 'The standard agent-memory build is an afternoon of work: embed every fact worth keeping, upsert it into a vector store, and before each reply pull the top-k most similar memories back into context. And for what it\'s built for, it works. Ask "what did this user say about the Berlin migration" and the right snippets come back, ranked by cosine distance. Recall is solved enough that it feels like *memory* is solved.',
      },
      {
        kind: "p",
        text: 'Then the agent has been running for a month, and you ask its memory a different kind of question: "how many users asked about pricing this month?" "Average deal size per stage?" "Top 10 topics I logged, ranked by count?" The store dutifully returns the twenty memories most *similar to the question text*, the LLM eyeballs them, and you get a confident, specific, wrong number.',
      },
      { kind: "h2", text: "Recall is similarity. Reporting is aggregation." },
      {
        kind: "p",
        text: "Nothing malfunctioned — the two questions want different machines. A vector store's primitive is nearest-neighbour search: embed the query, rank stored vectors by distance, return the top-k, optionally narrowed by a metadata filter. That is the whole contract. There is no `COUNT`, no `GROUP BY`, no `JOIN`, no `HAVING` — a similarity engine ships no query planner, and even the metadata filter only narrows candidates *around* the approximate search, so what comes back is still a ranking of similar items, never a computed result set.",
      },
      {
        kind: "p",
        text: '"How many" has to touch **every matching row**. If the agent logged 4,000 memories and top-k is 20, the context the LLM sees is structurally incapable of producing the count — and an LLM doing arithmetic over a retrieved sample is a hallucination generator, not a query engine. The failure is quiet, too: the answer arrives fluent and plausible, and nothing flags that it was computed from half a percent of the data.',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- \"top topics this month, ranked by count\" is not a similarity query.\n-- It's this — and it must scan every matching row, not the top-k:\nSELECT topic, count(*) AS mentions\nFROM memories\nWHERE created_at >= date_trunc('month', now())\nGROUP BY topic\nORDER BY mentions DESC\nLIMIT 10;",
      },
      {
        kind: "p",
        text: 'So the split worth keeping: when the question is **"find what\'s like this"** — RAG context, related-document lookup, fuzzy recall over conversation — a vector store is exactly the right machine, and a managed one like Pinecone is genuinely good at it. When the question is **"count, group, or rank what I stored"**, the memory needs to be typed rows behind a real query planner. Neither machine substitutes for the other, and bolting a bigger LLM onto the first one doesn\'t turn it into the second.',
      },
      {
        kind: "p",
        text: "They compose cleanly: vector store as the recall layer, relational store as the analytical one. That second layer is what [nlqdb](https://nlqdb.com) is — a real Postgres the agent provisions itself over MCP and queries in plain English, with the compiled SQL shown so you can read exactly what ran. The honest caveat cuts the other way too: nlqdb ships no embedding search, so it is not your recall layer. Pick the store per question shape — the full side-by-side is at [nlqdb vs Pinecone](/vs/pinecone/).",
      },
    ],
  },
  {
    slug: "store-form-submissions-without-a-backend",
    title:
      'You don\'t need a backend to store form submissions. You need a place to ask "how many."',
    description:
      'Storing a signup is a trivial insert — no server needed. The part that wants a database is the reporting: "signups per day," "which referrer converted" — aggregations that want a query planner.',
    date: "2026-07-02",
    anchor: {
      label: "Store form submissions without a backend",
      path: "/solve/store-form-submissions-without-backend",
    },
    body: [
      {
        kind: "p",
        text: 'Every landing page hits the same wall around hour three: the signup form works, but where do the emails actually *go*? The reflex is to stand up a server and a database for what is, honestly, an `INSERT` and an occasional `COUNT`. So most people reach for a form service instead — and that solves storage, but quietly splits your data from your questions. The submissions live in someone else\'s dashboard; the moment you want "signups per day since launch" or "which referrer actually converted," you\'re exporting a CSV and pivoting it by hand.',
      },
      { kind: "h2", text: "Two problems hiding in one, with different shapes" },
      {
        kind: "p",
        text: '**Capture** is a write — a small one, and it genuinely doesn\'t need a server: an insert call from the page\'s own `fetch`, or a ten-line serverless function, is enough, as long as the write key isn\'t sitting in your client HTML. **Reporting** is a read, and it\'s the part that actually wants a database — because "how many per day," "top source this week," and "conversion by campaign" are aggregations, and aggregations want a query planner, not a spreadsheet and a human.',
      },
      {
        kind: "code",
        lang: "sql",
        code: "-- capture: one small insert per submission (no server required)\nINSERT INTO signups (email, referrer, created_at)\nVALUES ($1, $2, now());\n\n-- reporting: the part that actually wants a query planner\nSELECT date_trunc('day', created_at) AS day, count(*) AS signups\nFROM signups\nGROUP BY day\nORDER BY day;",
      },
      {
        kind: "p",
        text: 'The mistake is picking a tool that\'s great at the write and leaves you alone with the read. A form service nails capture and hands you a list. A spreadsheet-via-webhook nails capture and hands you a tab you pivot by hand. What you want is for the place the rows land to also be a place you can *ask questions of* — ideally in plain English, so the day-one question ("did anyone sign up?") and the week-two question ("which tweet drove it?") are the same two-second action, not a data chore.',
      },
      {
        kind: "p",
        text: "That's the shape worth looking for, whatever you build it on: **storage you can also interrogate.** Each submission is a row in a real Postgres, and the reporting question is one English goal — `signups grouped by day with a count` — that compiles to SQL you can read before you trust it.",
      },
      {
        kind: "p",
        text: "That's how [nlqdb](https://nlqdb.com) works, but the point isn't the tool — it's refusing to let your form data land somewhere you can't ask it anything. The honest caveat that applies to *any* version of this: the public read widget isn't a write endpoint, so capture still goes through a key the browser never sees, and email delivery plus spam filtering stay your front-end's and your ESP's job. Storage isn't the hard part. Not being able to ask your own data a question is.",
      },
    ],
  },
  {
    slug: "not-in-subquery-null-trap",
    title: "NOT IN returned zero rows. It wasn't your data — it was one NULL.",
    description:
      "Why WHERE id NOT IN (SELECT …) silently returns nothing when the subquery contains a NULL, and the two anti-join shapes (NOT EXISTS, LEFT JOIN … IS NULL) that never lie to you.",
    date: "2026-07-01",
    anchor: {
      label: "Find rows with no match in another table",
      path: "/solve/find-rows-with-no-match-in-another-table",
    },
    body: [
      {
        kind: "p",
        text: '"Which customers never placed an order?" is a question you ask constantly — products never sold, users with no login this month, invoices with no payment. It\'s a set difference, and the obvious query is a quiet trap:',
      },
      {
        kind: "code",
        lang: "sql",
        code: "SELECT * FROM customers\nWHERE id NOT IN (SELECT customer_id FROM orders);   -- returns nothing. why?",
      },
      {
        kind: "p",
        text: "If a single `customer_id` in that subquery is NULL, you get **zero rows** — no error, no warning. Here's why: `NOT IN (a, b, NULL)` expands to `id <> a AND id <> b AND id <> NULL`. That last comparison is never `true` — comparing anything to NULL is `unknown` — so the whole `AND` chain can never be `true`, and every row is rejected. One NULL in the inner table silently empties your result.",
      },
      { kind: "h2", text: "The two shapes that actually work" },
      {
        kind: "code",
        lang: "sql",
        code: "-- LEFT JOIN ... IS NULL: keep the customers that found no matching order\nSELECT c.* FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;\n\n-- NOT EXISTS: a correlated anti-join, NULL-safe by construction\nSELECT * FROM customers c\nWHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);",
      },
      {
        kind: "p",
        text: "Both return the same rows for a plain anti-join. `NOT EXISTS` stops at the first match and never trips over NULLs. The `LEFT JOIN ... IS NULL` form is just as correct — but if the join key isn't unique it can multiply rows *before* the filter, so know your grain. What neither of them does is silently lie to you the way `NOT IN` does.",
      },
      {
        kind: "p",
        text: 'The rule worth keeping: reach for `NOT EXISTS` (or `LEFT JOIN ... IS NULL`) for "rows with no match," and treat `NOT IN (subquery)` as a smell unless you\'re certain the subquery is NULL-free.',
      },
      {
        kind: "p",
        text: "If you'd rather not re-derive which shape is safe every time: [nlqdb](https://nlqdb.com) takes \"customers who never placed an order\" in English, compiles the NULL-safe anti-join, runs it read-only, and shows the SQL so you can confirm it isn't a `NOT IN`. Honest limit — it owns the Postgres it answers; bring-your-own-Postgres is signed-in only, not the public embed.",
      },
    ],
  },
  {
    slug: "zep-recall-vs-analytical-agent-memory",
    title:
      'Zep gives my agent perfect recall. It still can\'t answer "average per group" about its own memory.',
    description:
      "A temporal knowledge graph is genuinely good at recall — and has no query planner. When the question about agent memory is a GROUP BY, retrieval and aggregation are different machines.",
    date: "2026-07-01",
    anchor: { label: "nlqdb vs Zep — the full side-by-side", path: "/vs/zep" },
    body: [
      {
        kind: "p",
        text: "If you've wired up [Zep](https://www.getzep.com) you know the pitch: it's the Context Lake — a temporal knowledge graph (Graphiti, 27k+ stars) that stores every fact your agent learns as a node with a validity window, resolves entities, and hands back the most relevant facts at query time. For *recall* it's genuinely good, and it publishes benchmarks (LongMemEval, DMR) to prove it.",
      },
      {
        kind: "p",
        text: "But we kept hitting the same wall. Once the agent had logged a few hundred things, we wanted to ask questions *about* the memory, not retrieve from it:",
      },
      {
        kind: "ul",
        items: [
          '"Top 10 topics I logged this month, ranked by count."',
          '"Average deal size per stage for enterprise customers."',
        ],
      },
      {
        kind: "p",
        text: "A knowledge graph has no query planner. It returns relevant facts and hopes the LLM does the arithmetic — which is a hallucination generator, not a `GROUP BY`.",
      },
      {
        kind: "p",
        text: "The honest split (the full side-by-side lives at [nlqdb vs Zep](/vs/zep/)): Zep wins on temporal validity, entity resolution, and vector recall over conversation. nlqdb wins when the agent needs to **aggregate** its memory — it's a real Postgres the agent provisions and queries in English, so `GROUP BY / JOIN / HAVING` actually work. They compose: Zep the recall layer, nlqdb the analytical store. Pick the one that matches the question you actually need answered.",
      },
      {
        kind: "p",
        text: "(Landscape facts verified 2026-06-19; both products' weaknesses are in the comparison, not just ours.)",
      },
    ],
  },
  {
    slug: "null-timestamp-ttl-sweep-funnel-metric",
    title: "The NULL timestamp that broke a TTL sweep and a funnel metric at the same time",
    description:
      "A backfill is not a default: one nullable timestamp column made an age-based eviction a silent no-op and pinned a funnel metric at zero — the same NULL, two different failure modes.",
    date: "2026-07-01",
    body: [
      {
        kind: "p",
        text: 'A row in our `databases` registry has a `last_queried_at` column. Two unrelated systems read it: a daily sweep that evicts anonymous DBs whose `last_queried_at` is older than 90 days, and a funnel metric that counts "DBs that have ever returned an answer." Both quietly broke for the same reason, and the bug is worth sharing because it\'s a whole *class* of mistake, not a one-off.',
      },
      {
        kind: "p",
        text: "We added the column in a migration that backfilled existing rows (`UPDATE … SET last_queried_at = updated_at WHERE last_queried_at IS NULL`) — textbook. What we forgot: the `INSERT` on the create path never set the column. So every row created *after* the migration was `NULL`.",
      },
      { kind: "p", text: "Now watch both readers fail, differently:" },
      {
        kind: "ul",
        items: [
          "**The sweep silently keeps everything.** `WHERE last_queried_at < :cutoff` looks like it evicts old rows. But in SQL, `NULL < anything` is `NULL`, which is not `TRUE`, so a `NULL` row never matches a `<` predicate. The age-based eviction became a no-op for every new row. No error, no log — the table just grows.",
          '**The metric silently reads zero.** "DBs that returned an answer" was `COUNT(*) WHERE last_queried_at IS NOT NULL`. Every new row is `NULL`, so the metric is pinned at 0 regardless of what users actually did. We nearly shipped a "fix" for a conversion problem that didn\'t exist — the *instrument* was broken, not the funnel.',
        ],
      },
      { kind: "h2", text: "Three takeaways" },
      {
        kind: "ol",
        items: [
          "**A backfill is not a default.** If a column needs a value, set it at write time (a `DEFAULT`, or in every `INSERT`). A one-time backfill fixes the past and nothing else.",
          '**NULL is not "old" or "zero" — it\'s "unknown," and it poisons comparisons.** Any `<` / `>` / `!=` against a nullable column has a third outcome you have to design for. `COALESCE` at the read, or forbid the `NULL`.',
          '**Before "fixing" a metric that reads 0, prove the instrument can ever read non-zero.** Ours structurally couldn\'t.',
        ],
      },
      {
        kind: "p",
        text: "(Context: this was in [nlqdb](https://nlqdb.com), a service that turns plain-English HTML components into SQL — the anonymous-DB sweep is how we keep the free tier's storage bounded. The fix was two lines: seed the column at create, re-run the backfill once.)",
      },
    ],
  },
];

export function blogBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

// The blog post whose `anchor.path` points at a given `/solve/*` or `/vs/*`
// page — the reciprocal of the forward `anchor` link. The `/solve` and `/vs`
// templates render it as a "Further reading" backlink so the internal linking
// is bidirectional (indexation + session-depth yield, scorecard rows #6/#7).
export function blogByAnchorPath(path: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.anchor?.path === path);
}
