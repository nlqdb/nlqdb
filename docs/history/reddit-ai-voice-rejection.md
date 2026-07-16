# Reddit rejects AI-voiced posts — founder voice is mandatory

**What happened (2026-07-16).** The r/SQL variant of
`/blog/llm-concatenates-columns-text-to-sql` was posted verbatim from an
agent-polished draft. The community immediately flagged it as "a ChatGPT
post / AI copy-paste" and piled on; a defensive follow-up comment ("some
might benefit") drew further downvotes. The post's substance (real
BIRD-dev numbers, a genuine eval lesson) didn't save it — the *voice*
sank it before anyone engaged with the content.

**Root cause.** Polished blog-ese is an AI tell that technical
communities now pattern-match and punish: bolded section headers inside a
Reddit body, tidy triads, uniform em-dash cadence, "the takeaway that
generalizes" framing, flawless formatting, and a marketing-shaped closing
link. Each is fine on a blog; together on Reddit they read as machine
output regardless of who pressed submit. Checking "self-promotion rules"
was not enough — the failure mode was stylistic, not procedural.

**Rule going forward** (encoded in
[`distribution-queue.md`](../research/distribution-queue.md) conventions):

- Agents never produce final copy for human-posted venues (Reddit / HN /
  lobste.rs). The agent deliverable is a **fact sheet**: the numbers, the
  code snippets, the anchor link, suggested angle — raw material only.
- The founder writes the post in their own voice: short, no headers, no
  bold-structured sections, imperfect sentences allowed, first-person
  specifics ("I was scoring a model last week and...").
- If challenged in comments, engage once, plainly, or not at all — never
  defend with generic value claims; it reads as damage control and
  invites the pile-on.

**Why documented** (D5): the cost was real (reputation burn in a target
community listed across the queue's pending venue pointers) and the
failure is non-obvious — the draft *passed* a norms review and still
failed on voice.
