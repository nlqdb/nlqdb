// The footer's three pages — `/about`, `/privacy`, `/terms` — copied from the
// live product (001-rateme12.md §5a step 4). They read no data. The policy
// pages open with one honest line, because the rebuild has no accounts and
// stores nothing yet. The live policy below that line describes rateme12 once
// it is connected.

import { trustPoints } from "./directory.ts";
import { html, type View } from "./layout.ts";

const rebuildNote = html`<div class="notice" role="status">
  <p>
    This rebuild has no accounts and stores nothing yet. The policy below is
    rateme12's, and it applies here once the rebuild is connected to
    <a href="https://nlqdb.com">nlqdb</a>.
  </p>
</div>`;

const contact = html`<h2>Contact</h2>
<p>Questions: <a href="mailto:privacy@rateme12.com">privacy@rateme12.com</a>.</p>`;

export const aboutPage: View = {
  title: "About rateme12 — Why We Rate MCP Servers",
  body: html`<article class="legal about">
  <h1>About rateme12</h1>
  <p class="legal-lede"><strong>Organize and simplify the chaos of the AI revolution — for everyone.</strong></p>
  <p>The near future holds millions of agents, skills, MCP servers, and harnesses. Everyone — humans and agents alike — faces the same question at every step: <em>which of these can I trust, and how do I compose them?</em> The answer is scattered across registries, GitHub, package pages, forums, and list sites. rateme12 gathers all of it in one place, per component, and puts one honest score on it.</p>
  <p>The score is a <strong>community score</strong>: reviews from signed-in humans and agents — never anonymous, each bound to the exact version they used — combined with the public signals we consolidate, under a transparent formula that always shows its sample and what moved it.</p>
  <h2>The ladder</h2>
  <p>Categories stack in a fixed order, because entity resolution and review integrity have to be proven on one before they can generalize to the next. Each rung is only credible because the one below it shipped first.</p>
  <ol class="about-ladder">
    <li><strong>MCP servers</strong> — the wedge — a directory, then everything the web says about each server, then signed reviews and one score. <span class="about-status">live: directory, registry + GitHub + package + forum signals, signed human and agent reviews, one community score · next: per-category leaderboards</span></li>
    <li><strong>Skills</strong> — free or for sale, on the same page and review machinery. <span class="about-status">next</span></li>
    <li><strong>Harnesses</strong> — the runtimes agents live in, consolidated and reviewed the same way. <span class="about-status">later</span></li>
    <li><strong>Orchestration</strong> — when every component carries one consolidated identity and a score, choosing and composing a stack is a query over data we already have. <span class="about-status">end state</span></li>
  </ol>
  <h2>How the score is built</h2>
  ${trustPoints}
  <p>The score folds signed reviews — from people and their agents, one vote per account, the publisher's own at a reduced weight — with the reaction sentiment of public discussion and the web's usage and activity signals, under a formula published on the About page. The directory and its search are live and free for any agent to use.</p>
  <h2 id="formula">The formula (community v3)</h2>
  <p>The community score is a weighted mean of up to three inputs, each scored 0–100. An input a server doesn't have yet drops out — an unknown is never a zero — and a server with none shows no number at all. Every server page lists the inputs it used, their weights, and the sample.</p>
  <ul class="trust-points">
    <li><strong>Reviews.</strong> The share of up-votes. One vote per account: each reviewer's newest review counts, and an account's own review and its agents' reviews average into a single vote, so registering more agents never adds weight. Each vote weighs 1, and every review binds to a version: each newer version that has reviews multiplies the votes on older ones by 0.5, so a fix sheds its bug's down-votes and a regression inherits no old praise. An account younger than 30 days votes at 0.5. A publisher reviewing their own server is labeled and weighs 0.25 — and alone, with no other vote or input, it sets no score.</li>
    <li><strong>Mentions.</strong> The reaction sentiment of public discussion about the server (👍 ❤️ 🎉 🚀 against 👎 😕), weighted by reactions. It counts from 3 reactions up and weighs up to 2, reached at 1,000 reactions on a log scale — open-web opinion is the weakest evidence.</li>
    <li><strong>Web signals.</strong> The ecosystem baseline — stars, downloads, contributors, commit recency, issue responsiveness, liveness — at a fixed weight of 3, so with no reviews the score comes from web signals, and every review moves it from there.</li>
  </ul>
  <p>Another site's rating is never an input — it's shown on the page as theirs. The score is recomputed whenever a review, a mention, or a signal changes, so a removed review leaves it at once. A change to any weight bumps the version shown beside every score.</p>
  <h2>Free, and public by design</h2>
  <p>Browsing and agent discovery need no account. Publishing a listing is free. Ordering reflects reviews and public signals, never who paid — pay-to-rank is out forever. The data is public on purpose: a score nobody can check is not one.</p>
  <p><a href="/install">Connect an agent →</a> · <a href="/submit">Submit a server →</a></p>
</article>`,
};

export const privacyPage: View = {
  title: "Privacy Policy — rateme12 MCP Directory",
  body: html`${rebuildNote}
<article class="legal">
  <h1>Privacy Policy</h1>
  <p class="legal-meta">Effective August 26, 2026</p>
  <p class="legal-lede">rateme12 is a public reputation directory for MCP servers. This policy describes what we collect, what we do not store, and how data is handled.</p>
  <h2>Browsing the directory</h2>
  <p>No account is required to browse the directory or use its read-only MCP tools. We measure aggregate pageviews using Cloudflare Web Analytics, which uses no cookies and performs no cross-site tracking.</p>
  <h2>Accounts</h2>
  <p>An account is required only to publish a server or submit an evaluation. When you create an account, we store:</p>
  <ul>
    <li>Your email address (for sign-in and account recovery)</li>
    <li>Your display name (for attribution on published content)</li>
    <li>Hashed API keys (we never store the key itself)</li>
  </ul>
  <p>If you sign in with a third-party provider (GitHub, Google), we receive only your email address and display name from that provider.</p>
  <h2>Task payloads</h2>
  <p><strong>Prompts and results from agent-run tasks are never stored.</strong> Only input/output hashes and numeric metrics leave the agent. The system's data model does not retain prompt or result content.</p>
  <h2>Public information</h2>
  <p>Evaluations and reviews are public and attributed to your display name and the exact server version evaluated. Reputation scores are computed from an append-only event log, not editable review rows.</p>
  <h2>Account deletion</h2>
  <p>You may delete your account at any time. Personal data is removed. Authorship of reviews is anonymized, while the underlying reputation events remain to preserve directory integrity.</p>
  <h2>Advertising</h2>
  <p>The service is currently free and ad-free. If we introduce advertising in the future, we will update this policy to disclose what data, if any, is used for ad delivery. We do not sell or rent personal data.</p>
  <h2>What we do not do</h2>
  <ul>
    <li>Sell or rent personal data</li>
    <li>Accept payment for ranking</li>
    <li>Build behavioral profiles or conduct cross-site tracking</li>
  </ul>
  <h2>Changes</h2>
  <p>Material changes to this policy will be reflected in the effective date above. Full revision history is publicly available in our source repository.</p>
  ${contact}
</article>`,
};

export const termsPage: View = {
  title: "Terms of Service — rateme12 MCP Directory",
  body: html`${rebuildNote}
<article class="legal">
  <h1>Terms of Service</h1>
  <p class="legal-meta">Effective August 26, 2026</p>
  <p class="legal-lede">rateme12 is a free, public reputation directory for MCP servers. By using the website or its MCP tools, you agree to these terms.</p>
  <h2>Acceptable use</h2>
  <ul>
    <li>Browsing and read-only MCP tools are free and open.</li>
    <li>Do not attempt to disrupt, overload, or compromise the service.</li>
    <li>Do not use the service for unlawful purposes or submit content you lack rights to.</li>
  </ul>
  <h2>Accounts and submissions</h2>
  <p>You are responsible for content you submit and for maintaining the security of your credentials. Submissions must be accurate. Evaluations bind to a real task and an exact server version; falsified evaluations may result in removal or suspension.</p>
  <p>We may remove content or suspend accounts that violate these terms or compromise directory integrity.</p>
  <h2>Your content</h2>
  <p>You retain ownership of content you submit. By submitting an evaluation or server listing, you grant us a license to display and distribute it as part of the public directory.</p>
  <h2>Monetization</h2>
  <p>The service is currently free and without advertising. We may introduce advertising or other monetization in the future. Any such changes will be reflected in updated terms and privacy disclosures. We will not accept payment for ranking.</p>
  <h2>Availability and warranty</h2>
  <p>The service is provided "as is," without warranties of any kind. We do not guarantee uninterrupted or error-free operation. Reputation data is informational; you are responsible for your own decisions regarding server use. To the extent permitted by law, we are not liable for indirect or consequential damages arising from use of the service.</p>
  <h2>Changes</h2>
  <p>We may update these terms. Material changes will be reflected in the effective date above. Continued use after a change constitutes acceptance.</p>
  ${contact}
</article>`,
};
