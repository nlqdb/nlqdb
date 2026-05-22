// SK-ICP-003: reads icp:scored:* KV keys (written by icp-score.ts), clusters per persona, writes monthly evidence file to GitHub.

import { type Span, trace } from "@opentelemetry/api";
import type { IcpScoredItem } from "./icp-score.ts";

const TOP_N = 100;
const GH_API = "https://api.github.com";
const DEFAULT_REPO = "nlqdb/nlqdb";
const SCORED_KEY_PREFIX = "icp:scored:";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type IcpClusterDeps = {
  kv: KVNamespace;
  groqApiKey?: string;
  geminiApiKey?: string;
  ghToken: string;
  ghRepo?: string;
  logsnagToken?: string;
  logsnagProject?: string;
  fetch?: typeof fetch;
  tracer?: {
    startActiveSpan: (name: string, fn: (span: Span) => Promise<unknown>) => Promise<unknown>;
  };
};

export type IcpClusterResult = {
  personaItems: Record<string, number>;
  clustered: number;
  written: boolean;
};

type PersonaKey = "p1" | "p2" | "p3" | "p6";

const PERSONAS: ReadonlyArray<{ id: PersonaKey; label: string; description: string }> = [
  {
    id: "p1",
    label: "P1 — Solo Builder",
    description:
      "solo builders frustrated by SQL writing, ORM/migration boilerplate, DB provisioning overhead",
  },
  {
    id: "p2",
    label: "P2 — Agent Builder",
    description:
      "LLM/agent builders needing natural-language persistence without schema ceremony",
  },
  {
    id: "p3",
    label: "P3 — Analyst/PM",
    description: "analysts or PMs wanting to query data without SQL (Metabase/Retool pain)",
  },
  {
    id: "p6",
    label: "P6 — SRE/DevOps",
    description: "SRE/DevOps needing quick operational DB queries without writing SQL",
  },
];

type Cluster = {
  label: string;
  description: string;
  count: number;
  best_quote: string;
  top_urls: string[];
};

// --- KV helpers ---

async function listAllScoredKeys(kv: KVNamespace): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;

  do {
    const result = await kv.list({
      prefix: SCORED_KEY_PREFIX,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    for (const key of result.keys) {
      keys.push(key.name);
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return keys;
}

async function readScoredItems(kv: KVNamespace, keys: string[]): Promise<IcpScoredItem[]> {
  const BATCH = 50; // avoid hitting KV read limits in one tick
  const items: IcpScoredItem[] = [];

  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH);
    const values = await Promise.all(batch.map((k) => kv.get(k)));
    for (let j = 0; j < values.length; j++) {
      const v = values[j];
      if (!v) continue;
      try {
        items.push(JSON.parse(v) as IcpScoredItem);
      } catch {
        console.warn(JSON.stringify({ msg: "icp_cluster_malformed_kv", key: batch[j] }));
      }
    }
  }

  return items;
}

function groupByBestPersona(items: IcpScoredItem[]): Record<PersonaKey, IcpScoredItem[]> {
  const groups: Record<PersonaKey, IcpScoredItem[]> = { p1: [], p2: [], p3: [], p6: [] };
  const keys: PersonaKey[] = ["p1", "p2", "p3", "p6"];

  for (const item of items) {
    const best = keys.reduce((a, b) => (item[a] >= item[b] ? a : b));
    if (item[best] >= 5) groups[best].push(item);
  }

  for (const p of PERSONAS) {
    groups[p.id].sort((a, b) => b[p.id] - a[p.id]);
    if (groups[p.id].length > TOP_N) groups[p.id] = groups[p.id].slice(0, TOP_N);
  }

  return groups;
}

// --- LLM clustering ---

const CLUSTER_SYSTEM =
  `You cluster developer pain signals for product validation. Items are scored social-media posts about software development pain.\n\n` +
  `Cluster the items into 5-7 distinct themes. Return ONLY valid JSON, no prose:\n` +
  `{"clusters":[{"label":"<2-5 words>","description":"<1 sentence>","count":<N>,"best_quote":"<verbatim ≤200 chars from any item>","top_urls":["<url>","<url>"]}]}`;

function itemsToMsg(
  persona: { label: string; description: string },
  items: IcpScoredItem[],
): string {
  const payload = items.map((item) => ({
    id: item.id,
    title: item.title,
    text: (item.quote || item.title).slice(0, 200),
    url: item.url,
  }));
  return `Persona: ${persona.label} (${persona.description})\n\nItems (${items.length}):\n${JSON.stringify(payload)}`;
}

function parseClusters(text: string): Cluster[] {
  try {
    const json = JSON.parse(text) as { clusters?: unknown[] };
    if (!Array.isArray(json.clusters)) {
      console.warn(JSON.stringify({ msg: "icp_cluster_parse_unexpected_shape", text: text.slice(0, 100) }));
      return [];
    }
    return json.clusters
      .filter(
        (c): c is Record<string, unknown> =>
          typeof c === "object" && c !== null && "label" in c,
      )
      .map((c) => ({
        label: String(c["label"] ?? "").slice(0, 50),
        description: String(c["description"] ?? "").slice(0, 200),
        count: Math.max(0, Number(c["count"]) || 0),
        best_quote: String(c["best_quote"] ?? "").slice(0, 200),
        top_urls: Array.isArray(c["top_urls"])
          ? (c["top_urls"] as unknown[]).slice(0, 3).map(String)
          : [],
      }));
  } catch {
    return [];
  }
}

async function callGroqCluster(
  persona: { label: string; description: string },
  items: IcpScoredItem[],
  apiKey: string,
  fetcher: typeof fetch,
): Promise<Cluster[]> {
  const res = await fetcher(GROQ_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: CLUSTER_SYSTEM },
        { role: "user", content: itemsToMsg(persona, items) },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseClusters(json.choices?.[0]?.message?.content ?? "");
}

async function callGeminiCluster(
  persona: { label: string; description: string },
  items: IcpScoredItem[],
  apiKey: string,
  fetcher: typeof fetch,
): Promise<Cluster[]> {
  const url = `${GEMINI_BASE}/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${CLUSTER_SYSTEM}\n\n${itemsToMsg(persona, items)}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: 2000,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return parseClusters(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
}

async function clusterPersona(
  persona: (typeof PERSONAS)[number],
  items: IcpScoredItem[],
  deps: Pick<IcpClusterDeps, "groqApiKey" | "geminiApiKey" | "fetch">,
  tracer: NonNullable<IcpClusterDeps["tracer"]>,
): Promise<Cluster[]> {
  if (items.length === 0 || (!deps.groqApiKey && !deps.geminiApiKey)) return [];

  const fetcher = deps.fetch ?? fetch;
  let clusters: Cluster[] = [];

  await tracer.startActiveSpan("nlqdb.icp.cluster", async (span: Span) => {
    span.setAttribute("nlqdb.icp.persona", persona.id);
    span.setAttribute("nlqdb.icp.item_count", items.length);
    try {
      if (deps.groqApiKey) {
        clusters = await callGroqCluster(persona, items, deps.groqApiKey, fetcher);
        span.setAttribute("nlqdb.icp.cluster.provider", "groq");
      } else if (deps.geminiApiKey) {
        clusters = await callGeminiCluster(persona, items, deps.geminiApiKey, fetcher);
        span.setAttribute("nlqdb.icp.cluster.provider", "gemini");
      }
    } catch (err) {
      span.recordException(err as Error);
      if (deps.groqApiKey && deps.geminiApiKey) {
        try {
          clusters = await callGeminiCluster(persona, items, deps.geminiApiKey, fetcher);
          span.setAttribute("nlqdb.icp.cluster.provider", "gemini-fallback");
        } catch (geminiErr) {
          span.recordException(geminiErr as Error);
          console.error(
            JSON.stringify({
              msg: "icp_cluster_both_failed",
              persona: persona.id,
              message: geminiErr instanceof Error ? geminiErr.message : String(geminiErr),
            }),
          );
        }
      } else {
        console.error(
          JSON.stringify({
            msg: "icp_cluster_primary_failed",
            persona: persona.id,
            provider: deps.groqApiKey ? "groq" : "gemini",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    } finally {
      span.setAttribute("nlqdb.icp.cluster.count", clusters.length);
      span.end();
    }
  });

  return clusters;
}

// --- Evidence markdown ---

function yyyymm(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function escMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function generateMarkdown(
  groups: Record<PersonaKey, IcpScoredItem[]>,
  clustersByPersona: Record<PersonaKey, Cluster[]>,
  generatedAt: number,
): string {
  const month = yyyymm(generatedAt);
  const dateStr = isoDate(generatedAt);
  const totalItems = Object.values(groups).reduce((s, arr) => s + arr.length, 0);

  const lines: string[] = [
    `# ICP Evidence — ${month}`,
    "",
    `> Auto-generated ${dateStr}. ${totalItems} scored items across ${PERSONAS.length} personas.`,
    "",
    "## Persona summary",
    "",
    "| Persona | Items | Clusters |",
    "|---|---|---|",
  ];

  for (const p of PERSONAS) {
    lines.push(`| ${p.label} | ${groups[p.id].length} | ${clustersByPersona[p.id].length} |`);
  }

  // Primary ICP: persona with highest items × average score (weighted signal).
  let primaryLabel = PERSONAS[0]?.label ?? "P1 — Solo Builder";
  let topWeight = 0;
  for (const p of PERSONAS) {
    const its = groups[p.id];
    if (its.length === 0) continue;
    const avg = its.reduce((s, i) => s + i[p.id], 0) / its.length;
    const w = its.length * avg;
    if (w > topWeight) {
      topWeight = w;
      primaryLabel = p.label;
    }
  }

  lines.push("", `Primary ICP signal: **${primaryLabel}** (highest weighted score).`, "");

  for (const p of PERSONAS) {
    const its = groups[p.id];
    const cls = clustersByPersona[p.id];

    lines.push(`## ${p.label} (${its.length} items, ${cls.length} clusters)`, "");

    if (cls.length > 0) {
      lines.push("### Clusters", "", "| # | Label | Count | Best quote |", "|---|---|---|---|");
      cls.forEach((c, i) => {
        const q = c.best_quote ? `"${escMd(c.best_quote)}"` : "—";
        lines.push(`| ${i + 1} | ${escMd(c.label)} | ${c.count} | ${q} |`);
      });
      lines.push("");
    }

    if (its.length > 0) {
      const top = its.slice(0, 20);
      lines.push("### Top items", "", "| Score | Source | Title | Quote |", "|---|---|---|---|");
      for (const item of top) {
        const q = item.quote ? `"${escMd(item.quote)}"` : "—";
        lines.push(`| ${item[p.id]} | ${item.source} | ${escMd(item.title).slice(0, 60)} | ${q} |`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// --- GitHub Contents API ---

function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  // Chunked to avoid O(n²) string concatenation and spread call-stack overflow.
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    parts.push(String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK))));
  }
  return btoa(parts.join(""));
}

async function getFileSha(
  fetcher: typeof fetch,
  ghToken: string,
  repo: string,
  path: string,
): Promise<string | undefined> {
  const res = await fetcher(`${GH_API}/repos/${repo}/contents/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${ghToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GH GET ${res.status}`);
  const json = (await res.json()) as { sha?: string };
  return json.sha;
}

async function writeFile(
  fetcher: typeof fetch,
  ghToken: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<void> {
  const body: Record<string, unknown> = {
    message,
    content: encodeBase64(content),
    branch: "main",
  };
  if (sha) body["sha"] = sha;

  const res = await fetcher(`${GH_API}/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${ghToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GH PUT ${res.status}: ${text.slice(0, 200)}`);
  }
  await res.text().catch(() => {});
}

// --- LogSnag ---

async function notifyLogSnag(
  fetcher: typeof fetch,
  token: string,
  project: string,
  result: IcpClusterResult,
  month: string,
): Promise<void> {
  try {
    const res = await fetcher("https://api.logsnag.com/v1/log", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        project,
        channel: "icp-mining",
        event: "Evidence File Updated",
        description: `${month}: ${result.clustered} clusters. Written: ${result.written}.`,
      }),
    });
    if (!res.ok)
      console.warn(JSON.stringify({ msg: "icp_cluster_logsnag_error", status: res.status }));
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "icp_cluster_logsnag_exception",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

// --- Main ---

export async function runIcpCluster(deps: IcpClusterDeps): Promise<IcpClusterResult> {
  const fetcher = deps.fetch ?? fetch;
  const repo = deps.ghRepo ?? DEFAULT_REPO;
  const tracer: NonNullable<IcpClusterDeps["tracer"]> =
    deps.tracer ??
    (() => {
      const t = trace.getTracer("@nlqdb/api");
      return {
        startActiveSpan: (name: string, fn: (span: Span) => Promise<unknown>) =>
          t.startActiveSpan(name, fn),
      };
    })();

  const keys = await listAllScoredKeys(deps.kv);
  if (keys.length === 0) return { personaItems: {}, clustered: 0, written: false };

  const allItems = await readScoredItems(deps.kv, keys);
  if (allItems.length === 0) return { personaItems: {}, clustered: 0, written: false };

  const groups = groupByBestPersona(allItems);

  const personaItems: Record<string, number> = {};
  for (const p of PERSONAS) personaItems[p.id] = groups[p.id].length;

  const clustersByPersona: Record<PersonaKey, Cluster[]> = { p1: [], p2: [], p3: [], p6: [] };
  await Promise.all(
    PERSONAS.map(async (p) => {
      try {
        clustersByPersona[p.id] = await clusterPersona(p, groups[p.id], deps, tracer);
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "icp_persona_cluster_failed",
            persona: p.id,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }),
  );

  const clustered = Object.values(clustersByPersona).reduce((s, arr) => s + arr.length, 0);

  const now = Date.now();
  const month = yyyymm(now);
  const markdown = generateMarkdown(groups, clustersByPersona, now);
  const filePath = `docs/research/icp-evidence-${month}.md`;

  let written = false;
  await tracer.startActiveSpan("nlqdb.icp.github_write", async (span: Span) => {
    span.setAttribute("nlqdb.icp.file_path", filePath);
    try {
      const sha = await getFileSha(fetcher, deps.ghToken, repo, filePath);
      span.setAttribute("nlqdb.icp.file_exists", sha !== undefined);
      await writeFile(
        fetcher,
        deps.ghToken,
        repo,
        filePath,
        markdown,
        `chore(icp): update evidence file ${month}`,
        sha,
      );
      written = true;
    } catch (err) {
      span.recordException(err as Error);
      console.error(
        JSON.stringify({
          msg: "icp_cluster_github_write_failed",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      span.setAttribute("nlqdb.icp.written", written);
      span.end();
    }
  });

  const result: IcpClusterResult = { personaItems, clustered, written };

  if (deps.logsnagToken && deps.logsnagProject) {
    await notifyLogSnag(fetcher, deps.logsnagToken, deps.logsnagProject, result, month);
  }

  return result;
}
