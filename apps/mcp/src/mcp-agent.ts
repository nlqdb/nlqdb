import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer as createNlqMcpServer } from "@nlqdb/mcp";
import { createClient, NlqdbApiError } from "@nlqdb/sdk";
import { McpAgent } from "agents/mcp";

export type McpAgentProps = {
  bearer: string;
  bearerHash: string;
  userId: string;
  mcpHost: string;
  deviceId: string;
};

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

// Durable-Object MCP agent per OAuth grant (`SK-MCP-010` slice 3b).
// Caches the bound `sk_mcp_*` and re-probes its `revoked_at` every
// `REVALIDATE_TTL_MS` per `SK-MCP-014`.
export class NlqdbMcpAgent extends McpAgent<McpAgentEnv, McpAgentState, McpAgentProps> {
  server!: McpServer;

  override initialState: McpAgentState = {
    lastRevalidatedAt: 0,
    revoked: false,
  };

  async init() {
    const props = this.requireProps();
    this.server = createNlqMcpServer({
      client: createClient({
        apiKey: props.bearer,
        ...(this.env.NLQDB_API_BASE_URL ? { baseUrl: this.env.NLQDB_API_BASE_URL } : {}),
        fetch: this.gatedFetch.bind(this),
      }),
      name: SERVICE_NAME,
      version: SERVICE_VERSION,
    });
  }

  // Pre-flight revocation check on every upstream call — saves a round-trip when the cache says revoked.
  private async gatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    await this.ensureKeyActive();
    return globalThis.fetch(input, init);
  }

  private async ensureKeyActive(): Promise<void> {
    if (this.state.revoked) throw makeKeyRevokedError();
    if (Date.now() - this.state.lastRevalidatedAt < REVALIDATE_TTL_MS) return;

    const props = this.requireProps();
    // Probe via a fresh client to avoid recursing through `gatedFetch`.
    const probe = createClient({
      apiKey: props.bearer,
      ...(this.env.NLQDB_API_BASE_URL ? { baseUrl: this.env.NLQDB_API_BASE_URL } : {}),
    });
    try {
      const status = await probe.getKeyStatus(props.bearerHash);
      if (status.revoked) {
        this.markRevoked();
        throw makeKeyRevokedError();
      }
      this.setState({ ...this.state, lastRevalidatedAt: Date.now() });
    } catch (err) {
      // 404 = key row gone (rotated); 401 = key bounced. Both mean revoked.
      if (err instanceof NlqdbApiError && (err.httpStatus === 404 || err.httpStatus === 401)) {
        this.markRevoked();
        throw makeKeyRevokedError();
      }
      // Network blip — fail open against the cached state.
    }
  }

  private markRevoked(): void {
    this.setState({ ...this.state, revoked: true, lastRevalidatedAt: Date.now() });
  }

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
