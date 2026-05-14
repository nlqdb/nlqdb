// Durable-Object-backed MCP agent for slice 3b (`SK-MCP-010`).
//
// `MyMcpAgent extends McpAgent<Env, State, Props>`:
//   • `Env`         — Worker bindings (`OAUTH_KV`, `MCP_AGENT`, plus
//                     vars). Auth-of-record stays in `apps/api/`; no
//                     D1 / KV hits from this DO except OAuth metadata
//                     reads via `OAuthProvider`.
//   • `State`       — `SK-MCP-014` revalidation stamp. Persisted on
//                     the DO's embedded SQL store so a session that
//                     hibernates and wakes still knows when it last
//                     re-checked the key's `revoked_at`.
//   • `Props`       — values supplied to `completeAuthorization` at
//                     the consent step. Holds the bound `sk_mcp_*`
//                     bearer + tenant claims. `this.props.bearer` is
//                     what gets forwarded to `apps/api/` on every
//                     tool call.
//
// One DO instance per active OAuth grant (the OAuthProvider's
// session id, exposed via `McpAgent.serve`). Revocation propagates
// in ≤ 1 s per `SK-MCP-014`: every tool call past the cache TTL
// re-probes `GET /v1/keys/:hash/status` via the SDK; a revoked or
// 404 response throws an `SK-MCP-006` envelope back through the
// MCP error path.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer as createNlqMcpServer } from "@nlqdb/mcp";
import { createClient, NlqdbApiError } from "@nlqdb/sdk";
import { McpAgent } from "agents/mcp";

export type McpAgentProps = {
  // Plaintext `sk_mcp_<host>_<device>_*` bearer minted by
  // `mintSkMcpKey` at the OAuth callback. Forwarded as
  // `Authorization: Bearer` on every upstream call. Sliced to the
  // 8-char prefix (`sk_mcp_*`) when logged.
  bearer: string;
  // HMAC of the bearer — what `GET /v1/keys/:hash/status` probes.
  // Computed once at mint time so the hot path doesn't HMAC every
  // 1 s revalidation tick.
  bearerHash: string;
  // Claims for OTel + audit. Mirrors `sk_mcp` `Principal` shape.
  userId: string;
  mcpHost: string;
  deviceId: string;
};

// State persists across DO restarts. `lastRevalidatedAt` is the unix
// epoch ms; `< 1000 ms` since now means "fresh, no probe needed".
// `revoked` is true once we observe revocation — sticky so a flapping
// upstream can't accidentally re-authorize.
export type McpAgentState = {
  lastRevalidatedAt: number;
  revoked: boolean;
};

export type McpAgentEnv = {
  NLQDB_API_BASE_URL?: string;
};

const REVALIDATE_TTL_MS = 1000;
const SERVICE_NAME = "@nlqdb/mcp-server";
const SERVICE_VERSION = "0.1.0";

export class NlqdbMcpAgent extends McpAgent<McpAgentEnv, McpAgentState, McpAgentProps> {
  // `McpAgent` requires the `server` field at the class level. The
  // real registration happens in `init()` where `this.props` /
  // `this.env` are populated.
  server: McpServer = new McpServer({ name: SERVICE_NAME, version: SERVICE_VERSION });

  override initialState: McpAgentState = {
    lastRevalidatedAt: 0,
    revoked: false,
  };

  async init() {
    // `this.props` is typed as optional on the base class because
    // OAuthProvider populates it before `init()` runs. By the time
    // we're here it's always set; narrow once and reuse.
    const props = this.requireProps();
    // Wrap the SDK fetch so every upstream call goes through the
    // revalidation gate. A revoked key throws `key_revoked` before
    // the call leaves the DO — saves an upstream round-trip and
    // matches `SK-MCP-006`'s envelope.
    const client = createClient({
      apiKey: props.bearer,
      ...(this.env.NLQDB_API_BASE_URL ? { baseUrl: this.env.NLQDB_API_BASE_URL } : {}),
      fetch: this.gatedFetch.bind(this),
    });

    // `createNlqMcpServer` registers the three tools
    // (`nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe`) per
    // `SK-MCP-002`. We swap our pre-constructed server in so the DO
    // can hold the reference; the helper accepts either an existing
    // server or constructs one — we let it construct a fresh one and
    // adopt its tool registrations onto `this.server`.
    const populated = createNlqMcpServer({
      client,
      name: SERVICE_NAME,
      version: SERVICE_VERSION,
    });
    // McpServer registrations live on its internal `_registeredTools`.
    // Rather than peek into private state, we just replace our `server`
    // reference — the DO's `getServer()` (called by the SDK transport)
    // returns `this.server`, so swapping it before any request lands is
    // safe. `init()` runs once per session before the first JSON-RPC
    // message.
    this.server = populated;
  }

  // SDK `fetch` adapter — runs the revalidation check before every
  // upstream call. Throwing `NlqdbApiError("key_revoked")` here
  // propagates through `@nlqdb/mcp`'s `mapSdkError` to the MCP error
  // envelope per `SK-MCP-006`.
  private async gatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    await this.ensureKeyActive();
    return globalThis.fetch(input, init);
  }

  // Re-checks the key's `revoked_at` if the cache stamp is stale.
  // Throws `NlqdbApiError("key_revoked")` on revoked / 404 so the
  // current MCP request errors out with the `SK-MCP-006` shape.
  private async ensureKeyActive(): Promise<void> {
    if (this.state.revoked) {
      throw makeKeyRevokedError();
    }
    const now = Date.now();
    if (now - this.state.lastRevalidatedAt < REVALIDATE_TTL_MS) {
      return;
    }
    // Stale — probe `apps/api/`. We re-issue through a no-revalidate
    // SDK client to avoid infinite recursion on `gatedFetch`.
    const props = this.requireProps();
    const probe = createClient({
      apiKey: props.bearer,
      ...(this.env.NLQDB_API_BASE_URL ? { baseUrl: this.env.NLQDB_API_BASE_URL } : {}),
    });
    try {
      const status = await probe.getKeyStatus(props.bearerHash);
      if (status.revoked) {
        this.setState({ ...this.state, revoked: true, lastRevalidatedAt: Date.now() });
        throw makeKeyRevokedError();
      }
      this.setState({ ...this.state, lastRevalidatedAt: Date.now() });
    } catch (err) {
      if (err instanceof NlqdbApiError && (err.httpStatus === 404 || err.httpStatus === 401)) {
        // 404 = key row gone (rotated away); 401 = key itself
        // bounced. Either is a revocation from this DO's POV.
        this.setState({ ...this.state, revoked: true, lastRevalidatedAt: Date.now() });
        throw makeKeyRevokedError();
      }
      // Network failure on the probe — fail open with the current
      // cache rather than killing live sessions on a transient
      // upstream blip. The next 1 s tick re-probes.
      throw err;
    }
  }

  // `this.props` is optional on the base class because the framework
  // sets it after construction. By the time any tool call lands it
  // has been populated by `OAuthProvider.completeAuthorization`. A
  // missing `props` is a framework-invariant violation, not a runtime
  // error worth surfacing — fail loud.
  private requireProps(): McpAgentProps {
    if (!this.props) {
      throw new Error("McpAgent: this.props missing — OAuth grant did not populate the session");
    }
    return this.props;
  }
}

function makeKeyRevokedError(): NlqdbApiError {
  return new NlqdbApiError(
    "nlqdb: sk_mcp_* key has been revoked",
    401,
    "unauthorized",
    "/v1/keys/:hash/status",
    {
      status: "unauthorized",
      message:
        "This MCP key was revoked. Sign in again: run `nlq mcp install` or paste the connector URL into your host's settings.",
    },
  );
}
