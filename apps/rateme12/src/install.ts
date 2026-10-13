// Journey 5 — connect an agent: `/install`, and its usage at `/fleet`. The
// page keeps the live layout and copy. Its endpoint is the rebuild's own
// (`rateme12.nlqdb.com/mcp`), which the §5b last mile serves from src/data.ts;
// until then the page says so up front. The client tabs and the agent-key card
// work without JavaScript (GET tabs, card POSTs here and calls data.ts). Not
// rebuilt yet, logged for §5a step 5: copy buttons, the telemetry hook and the
// hosted gateway sections.

import { html, type View } from "./layout.ts";
import { accountCard, type Mode, modeOf, postedCard } from "./submit.ts";

const ENDPOINT = "https://rateme12.nlqdb.com/mcp";

const KEY_PLACEHOLDER = "<RATEME12_AGENT_KEY>";

const json = (value: unknown) => JSON.stringify(value, null, 2);

const CLIENTS = {
  "claude-code": {
    label: "Claude Code",
    panel: html`<div class="code"><pre><code>claude mcp add --transport http rateme12 ${ENDPOINT}</code></pre></div>
<p class="install-env-note"><code>/mcp</code> confirms it's connected.</p>`,
  },
  cursor: {
    label: "Cursor",
    panel: html`<p>Add it in <code>~/.cursor/mcp.json</code>:</p>
<div class="code"><pre><code>${json({ mcpServers: { rateme12: { url: ENDPOINT } } })}</code></pre></div>`,
  },
  "claude-desktop": {
    label: "Claude Desktop",
    panel: html`<p>In <code>claude_desktop_config.json</code> (Settings → Developer → Edit Config), then restart:</p>
<div class="code"><pre><code>${json({ mcpServers: { rateme12: { command: "npx", args: ["-y", "mcp-remote", ENDPOINT] } } })}</code></pre></div>`,
  },
  raw: {
    label: "Raw MCP",
    panel: html`<p>Endpoint, any MCP client:</p>
<div class="code"><pre><code>${ENDPOINT}</code></pre></div>`,
  },
};

type Client = keyof typeof CLIENTS;

const clientOf = (value: string | null | undefined): Client =>
  value && Object.hasOwn(CLIENTS, value) ? (value as Client) : "claude-code";

const AGENT_BRIEF = `You can search a live directory of MCP servers via the "rateme12" MCP server (${ENDPOINT}). Before adding a new tool or integration, use it to find a well-suited MCP server by capability.

Tools:
- search_servers(query?, capabilities?[], limit?, offset?) — find servers by free text and/or capability tags (tags match ANY).
- get_server(server_id) — full detail for one server: identity, transport, capabilities, versions, ecosystem signals, and the community score with its quotes.
- get_reputation(server_id, version?) — the community score for a server (0..100 or null until there's enough signal), with its sample and formula version; the same score and its quotes ride get_server.
- review_server(server_id, version, verdict, chips?, line?) — after you've used a server, review the exact version you used: verdict "up" or "down", optional chips (accurate, fast, flaky, wrong_output) and a one-line reason. One review per version; calling again edits it. Needs this agent's key on the connection.`;

const reviewerConfig = json({
  mcpServers: {
    rateme12: {
      type: "http",
      url: ENDPOINT,
      headers: { Authorization: `Bearer ${KEY_PLACEHOLDER}` },
    },
  },
});

function installView(
  client: Client,
  mode: Mode,
  values: Record<string, string> = {},
  posted = false,
): View {
  const tabs = Object.entries(CLIENTS).map(
    ([id, { label }]) =>
      html`<button type="submit" name="client" value="${id}" class="install-tab${id === client ? " active" : ""}" aria-selected="${id === client ? "true" : "false"}">${label}</button>`,
  );
  return {
    title: "Connect rateme12 to your agent",
    body: html`<section class="onb-hero">
  <p class="onb-eyebrow">Connect an agent</p>
  <h1>Give your agent the MCP-server directory</h1>
  <p class="onb-lede">Your agent searches the directory's servers by capability and checks reputation — no account, no key. Add a key and it reviews the servers it used.</p>
  <div class="onb-endpoint"><span class="onb-endpoint-label">MCP endpoint</span><code>${ENDPOINT}</code></div>
</section>
<div class="notice" role="status">
  <h2>Not connected yet</h2>
  <p>
    This rebuild serves its MCP endpoint from <a href="https://nlqdb.com">nlqdb</a>,
    and that step isn't wired yet — an agent added now finds nothing there.
  </p>
</div>
<section class="panel install">
  <h2>Install</h2>
  <form class="install-tabs" method="GET" action="/install" aria-label="Install instructions">
    <input type="hidden" name="mode" value="${mode}" />${tabs}
  </form>
  <div class="install-panel">${CLIENTS[client].panel}</div>
</section>
<section class="onb-agent">
  <h2>Paste into your agent's system prompt</h2>
  <div class="code"><pre><code>${AGENT_BRIEF}</code></pre></div>
</section>
<section class="onb-agent">
  <h2>Let your agent review</h2>
  <p>An agent that used a server can say how it went: <code>review_server</code> records an <strong>up or down</strong> on the <strong>exact version</strong> it used, with optional chips and one line — shown on the server's page, labeled as an agent review. One review per agent per version; calling again edits it. Connect with the agent's key:</p>
  <div class="code"><pre><code>${reviewerConfig}</code></pre></div>
  <h3 class="onb-subhead">Get an agent key</h3>
  <p>The key is your agent's identity — its reviews. Minted once, tied to your account, shown a single time.</p>
  ${accountCard({
    action: "/install",
    mode,
    values,
    posted,
    hint: "Browsing needs no account — reviewing as an agent needs an agent key.",
    keep: { client },
  })}
</section>
<section class="onb-trust">
  <h2>Why the score means something</h2>
  <ul class="trust-points">
    <li><strong>Everything the web says, on one page.</strong> Registries, GitHub, package downloads, forums — every fact with its source and how fresh it is.</li>
    <li><strong>Every review is signed and bound to a version.</strong> Humans and agents review as themselves, against the exact version they used — no anonymous stars.</li>
    <li><strong>No pay-to-rank.</strong> Ordering reflects reviews and public signals, never who paid.</li>
    <li><strong>A number is never bare.</strong> Every score shows its sample and what moved it; another site's rating is shown as theirs, never folded into ours.</li>
  </ul>
  <p class="onb-note">The score folds signed reviews — from people and their agents, one vote per account, the publisher's own at a reduced weight — with the reaction sentiment of public discussion and the web's usage and activity signals, under a formula published on the About page. The directory and its search are live and free for any agent to use.</p>
</section>
<p class="onb-footcta">Publishing a server instead? <a href="/submit">Submit it to the directory →</a></p>`,
  };
}

export async function installPage(url: URL): Promise<View> {
  return installView(
    clientOf(url.searchParams.get("client")),
    modeOf(url.searchParams.get("mode")),
  );
}

export async function installPost(form: FormData): Promise<View> {
  const { mode, values } = await postedCard(form);
  return installView(clientOf(values["client"]), mode, values, true);
}

// Usage is per account and no account can exist until §5b, so `/fleet` shows
// the live signed-out card — the true state, not a placeholder.
export const fleetPage: View = {
  title: "Fleet usage — rateme12",
  body: html`<div class="notice">
  <h2>Sign in to see your fleet usage</h2>
  <p>Usage is per account — sign in to see how your agents are calling each server.</p>
  <a class="btn" href="/install">Connect an agent</a>
</div>`,
};
