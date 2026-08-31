# Idea: agent-prompting help interceptor

**Status:** raw idea — parked. Not related to nlqdb (yet). No implementation
decisions made; captured here so it isn't lost. We'll think about how (and
whether) to build it later.

## The idea

A scraper that collects, in near real time, posts from people asking for
help prompting their AI agents — across X, Reddit, and other forums and
platforms.

On top of it, a personal response board:

1. **Collect** — continuously scrape/poll X posts, Reddit threads, and other
   forums for people requesting help with prompting their agent.
2. **Board** — show the collected requests as a board of links I can scan
   and select from.
3. **Respond in-platform** — from the board, jump to (or post directly on)
   the original platform and answer there, not in a silo.
4. **Archive** — every collected question and every response I give is saved
   permanently, building a personal corpus of prompting Q&A.

## Open questions (for later, before any build)

- Which platforms first, and what does "real time" cost on each (X API
  pricing, Reddit API terms, forum scraping ToS)?
- Respond via API or just deep-link to the post and reply manually?
- Where does the saved Q&A corpus live, and what is it later used for
  (content, product research, an expert-knowledge asset)?
- Is there an eventual nlqdb tie-in (e.g. `docs/features/icp-mining/` and
  `docs/research/acquisition-channels.md` do adjacent interception work),
  or does this stay a separate tool?
