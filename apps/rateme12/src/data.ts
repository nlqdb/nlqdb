// The only module that will call @nlqdb/sdk (TEMPLATE.md §5): one function per
// §4 journey action of docs/history/dogfood-iterations/001-rateme12.md.
// Until the §5b last mile every call returns the honest "not connected yet"
// state — no mock rows, no fixtures (P6). Rows stay untyped on purpose: their
// shape is whatever nlqdb infers from the app's writes, never pre-modelled
// here (GLOBAL-042).

export type Row = Record<string, unknown>;

export type Result<T> = { status: "ok"; value: T } | { status: "not_connected" };

const notConnected = { status: "not_connected" } as const;

// Journey 1 — search / browse (`/`, `/c/[tag]`).
export async function searchServers(_input: {
  query?: string;
  tag?: string;
}): Promise<Result<Row[]>> {
  return notConnected;
}

// The category chips above every list.
export async function listCategories(): Promise<Result<Row[]>> {
  return notConnected;
}

// Journey 2 — server page (`/servers/[id]`), its publisher (`/publishers/[id]`).
export async function getServer(_id: string): Promise<Result<Row | null>> {
  return notConnected;
}

export async function getPublisher(_id: string): Promise<Result<Row | null>> {
  return notConnected;
}

// Journey 3 — rate the current version, list its reviews.
export async function listReviews(_serverId: string): Promise<Result<Row[]>> {
  return notConnected;
}

export async function rateServer(_input: {
  userId: string;
  serverId: string;
  vote: "up" | "down";
}): Promise<Result<Row>> {
  return notConnected;
}

// Journey 4 — submit a server (`/submit`). Fields pass through as the form
// carries them; rating, submitting and agent keys are signed-in (§4 auth model).
export async function submitServer(_input: {
  userId: string;
  form: Record<string, string>;
}): Promise<Result<Row>> {
  return notConnected;
}

// Journey 5 — connect an agent (`/install`), see its usage (`/fleet`).
export async function createAgentKey(_userId: string): Promise<Result<Row>> {
  return notConnected;
}

export async function getFleetUsage(_userId: string): Promise<Result<Row[]>> {
  return notConnected;
}
