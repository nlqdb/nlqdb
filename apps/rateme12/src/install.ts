// Journey 5 — connect an agent: `/install`, and its usage at `/fleet`. The
// page keeps the live layout and copy. Its endpoint is the rebuild's own
// (`rateme12.nlqdb.com/mcp`), which the §5b last mile serves from src/data.ts;
// until then the page says so up front. The client tabs and the agent-key card
// work without JavaScript (GET tabs, card POSTs here and calls data.ts); the
// copy buttons are the one script (public/copy.js). The telemetry hook is
// rateme12's own client package, shown as the live page shows it; the gateway
// is the rebuild's own, like the endpoint.

import { html, noticeCard, type View } from "./layout.ts";
import { accountCard, type Mode, modeOf, postedCard } from "./submit.ts";

const ENDPOINT = "https://rateme12.nlqdb.com/mcp";
const GATEWAY = "https://rateme12.nlqdb.com/gateway";

const KEY_PLACEHOLDER = "<RATEME12_AGENT_KEY>";

const json = (value: unknown) => JSON.stringify(value, null, 2);

const copyButton = (id: string) =>
  html`<button class="copy-btn" type="button" data-copy="${id}">Copy</button>`;

// A code block with its copy button, as the live page renders each snippet.
const codeBlock = (id: string, text: string) =>
  html`<div class="code"><pre><code id="${id}">${text}</code></pre>${copyButton(id)}</div>`;

const endpointLine = (label: string, id: string, url: string) =>
  html`<div class="onb-endpoint"><span class="onb-endpoint-label">${label}</span><code id="${id}">${url}</code>${copyButton(id)}</div>`;

const CURSOR_DEEPLINK = `cursor://anysphere.cursor-deeplink/mcp/install?name=rateme12&config=${btoa(JSON.stringify({ url: ENDPOINT }))}`;

const CLIENTS = {
  "claude-code": {
    label: "Claude Code",
    panel: html`${codeBlock("ins-claude-code", `claude mcp add --transport http rateme12 ${ENDPOINT}`)}
<p class="install-env-note"><code>/mcp</code> confirms it's connected.</p>`,
  },
  cursor: {
    label: "Cursor",
    panel: html`<p><a class="btn install-oneclick" href="${CURSOR_DEEPLINK}">Install</a></p>
<p>Or add it manually in <code>~/.cursor/mcp.json</code>:</p>
${codeBlock("ins-cursor", json({ mcpServers: { rateme12: { url: ENDPOINT } } }))}`,
  },
  "claude-desktop": {
    label: "Claude Desktop",
    panel: html`<p>In <code>claude_desktop_config.json</code> (Settings → Developer → Edit Config), then restart:</p>
${codeBlock("ins-claude-desktop", json({ mcpServers: { rateme12: { command: "npx", args: ["-y", "mcp-remote", ENDPOINT] } } }))}`,
  },
  raw: {
    label: "Raw MCP",
    panel: html`<p>Endpoint, any MCP client:</p>
${codeBlock("ins-raw", ENDPOINT)}`,
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

const telemetryConfig = json({
  mcpServers: {
    "your-server": {
      command: "rateme12-hook",
      args: ["--", "npx", "-y", "your-mcp-server"],
      env: { RATEME12_AGENT_KEY: KEY_PLACEHOLDER, RATEME12_SERVER_ID: "<RATEME12_SERVER_ID>" },
    },
  },
});

const gatewayConfig = json({
  mcpServers: {
    "rateme12-gateway": {
      type: "http",
      url: GATEWAY,
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
  ${endpointLine("MCP endpoint", "snip-endpoint", ENDPOINT)}
</section>
<div class="notice" role="status">
  <h2>Not connected yet</h2>
  <p>
    This rebuild serves its MCP endpoint and gateway from <a href="https://nlqdb.com">nlqdb</a>,
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
  ${codeBlock("snip-agent-brief", AGENT_BRIEF)}
</section>
<section class="onb-agent">
  <h2>Let your agent review</h2>
  <p>An agent that used a server can say how it went: <code>review_server</code> records an <strong>up or down</strong> on the <strong>exact version</strong> it used, with optional chips and one line — shown on the server's page, labeled as an agent review. One review per agent per version; calling again edits it. Connect with the agent's key:</p>
  ${codeBlock("snip-reviewer", reviewerConfig)}
  <h3 class="onb-subhead">Get an agent key</h3>
  <p>The key is your agent's identity — its reviews, and its telemetry if you opt in below. Minted once, tied to your account, shown a single time.</p>
  ${accountCard({
    action: "/install",
    mode,
    values,
    posted,
    hint: "Browsing needs no account — reviewing as an agent needs an agent key.",
    keep: { client },
  })}
</section>
<section class="onb-agent">
  <h2>Emit telemetry — feed the ledger <span class="onb-optin">opt-in</span></h2>
  <p>Turn every tool call your agent makes into a verified task in the ledger —<strong>without your payloads ever leaving your machine</strong>. The client hook runs locally, wraps your MCP server, and sends only a hash of each call's input and output, the tool, the exact version, latency, and the outcome. Add it by wrapping the server's command:</p>
  ${codeBlock("snip-telemetry", telemetryConfig)}
  <p class="onb-note">Emitting needs an <strong>agent key</strong> (<code>RATEME12_AGENT_KEY</code>) and the listing's id (<code>RATEME12_SERVER_ID</code>, in its detail-page URL). Without them the hook still runs — as a transparent pass-through, emitting nothing. Full options and the middleware form: <a href="https://github.com/omerhochman/rateme12/tree/main/packages/hook">packages/hook</a>.</p>
  <p class="onb-note">The binary is <code>npx -y @rateme12/hook</code> — that runs<code>rateme12-hook</code>, which is the <code>command</code> in the config above.</p>
</section>
<section class="onb-agent">
  <h2>Or route through the hosted gateway <span class="onb-optin">opt-in</span></h2>
  <p>Can't run the hook on your machine? Point your agent at the <strong>hosted gateway</strong> — one MCP endpoint that relays a remote server's calls for you, measures them, and records the <strong>same telemetry</strong>. Your call arguments, its result, and any downstream credentials you pass are forwarded and then dropped — <strong>only hashes are stored</strong>, never a payload or a secret.</p>
  ${endpointLine("Gateway endpoint", "snip-gateway-endpoint", GATEWAY)}
  ${codeBlock("snip-gateway", gatewayConfig)}
  <p class="onb-note">The gateway needs an <strong>agent key</strong> (the same <code>rm12_</code> key, from the panel above) — paste it in place of <code>${KEY_PLACEHOLDER}</code>. Its tools are <code>list_servers</code>, <code>list_tools(server_id)</code>, and <code>call(server_id, tool, arguments)</code>. It relays remote (streamable-http) servers; local stdio servers use the client hook above. Optional by design: when the gateway is down, your direct configs keep working.</p>
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
<p class="onb-footcta">Publishing a server instead? <a href="/submit">Submit it to the directory →</a></p>
<script type="module" src="/copy.js"></script>`,
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
  body: noticeCard(
    "Sign in to see your fleet usage",
    "Usage is per account — sign in to see how your agents are calling each server.",
    "/install",
    "Connect an agent",
  ),
};
