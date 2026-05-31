// ICP pain-signal scorer — SK-ICP-002, prefilter dropped per SK-ICP-010.
// Runs after each weekly scrape: sends every scraped item to the free-chain
// LLM (Groq → Gemini fallback) to score 0–10 per persona. The LLM score plus
// RELEVANCE_FLOOR is the only relevance gate — items scoring below the floor
// on every persona are discarded.
//
// KV key schema:
//   icp:scored:<YYYYMMDD>:<source>:<id>  → JSON IcpScoredItem  TTL 30 days

import { type Span, trace } from "@opentelemetry/api";
import type { IcpItem } from "./icp-scrape.ts";

export type IcpScoredItem = {
  source: string;
  id: string;
  url: string;
  title: string;
  ts: number;
  p1: number;
  p2: number;
  p3: number;
  p6: number;
  quote: string;
};

export type IcpScoreDeps = {
  kv: KVNamespace;
  groqApiKey?: string;
  geminiApiKey?: string;
  fetch?: typeof fetch;
  tracer?: {
    startActiveSpan: (name: string, fn: (span: Span) => Promise<unknown>) => Promise<unknown>;
  };
};

export type IcpScoreResult = {
  scored: number;
  skipped: number;
  stored: number;
};

const SCORED_TTL_SECONDS = 30 * 24 * 60 * 60;
const RELEVANCE_FLOOR = 5;
const BATCH_SIZE = 20;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const FETCH_TIMEOUT_MS = 15_000;

// Concise rubric kept inline — importing from personas.md MD is not viable in Workers.
const SYSTEM_PROMPT = `Score social-media posts for fit with nlqdb — a tool that lets developers query databases in plain English instead of SQL.

Personas (score each 0-10, 0=irrelevant, 5=somewhat relevant, 10=perfect fit):
P1: solo builders frustrated by SQL writing, ORM/migration boilerplate, DB provisioning overhead
P2: LLM/agent builders needing natural-language persistence for agents without schema ceremony
P3: analysts or PMs wanting to query data without SQL (Metabase/Retool pain)
P6: SRE/DevOps needing quick operational DB queries without writing SQL

Return ONLY valid JSON with no prose:
{"results":[{"id":"<id>","p1":N,"p2":N,"p3":N,"p6":N,"quote":"<verbatim ≤120 chars capturing the pain, empty string if none>"},...]}`;

type RawScore = { id: string; p1: number; p2: number; p3: number; p6: number; quote: string };

function parseScores(text: string): RawScore[] {
  try {
    const json = JSON.parse(text) as { results?: unknown[] };
    if (!Array.isArray(json.results)) return [];
    return json.results
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null && "id" in r)
      .map((r) => ({
        id: String(r["id"]),
        p1: Math.min(10, Math.max(0, Number(r["p1"]) || 0)),
        p2: Math.min(10, Math.max(0, Number(r["p2"]) || 0)),
        p3: Math.min(10, Math.max(0, Number(r["p3"]) || 0)),
        p6: Math.min(10, Math.max(0, Number(r["p6"]) || 0)),
        quote: String(r["quote"] ?? "").slice(0, 120),
      }));
  } catch {
    return [];
  }
}

function itemsToUserMsg(batch: IcpItem[]): string {
  return JSON.stringify(
    batch.map((item) => ({
      id: item.id,
      title: item.title,
      text: (item.text ?? "").slice(0, 400),
    })),
  );
}

async function callGroq(
  batch: IcpItem[],
  apiKey: string,
  fetcher: typeof fetch,
): Promise<RawScore[]> {
  const res = await fetcher(GROQ_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: itemsToUserMsg(batch) },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseScores(json.choices?.[0]?.message?.content ?? "");
}

async function callGemini(
  batch: IcpItem[],
  apiKey: string,
  fetcher: typeof fetch,
): Promise<RawScore[]> {
  const url = `${GEMINI_BASE}/gemini-2.5-flash:generateContent`;
  const res = await fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${itemsToUserMsg(batch)}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: 2000,
      },
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return parseScores(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
}

function yyyymmdd(ts: number): string {
  const d = new Date(ts);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("");
}

export async function runIcpScore(items: IcpItem[], deps: IcpScoreDeps): Promise<IcpScoreResult> {
  if (items.length === 0) return { scored: 0, skipped: 0, stored: 0 };

  const fetcher = deps.fetch ?? fetch;

  if (!deps.groqApiKey && !deps.geminiApiKey) {
    return { scored: 0, skipped: items.length, stored: 0 };
  }

  const tracer =
    deps.tracer ??
    (() => {
      const t = trace.getTracer("@nlqdb/api");
      return {
        startActiveSpan: (name: string, fn: (span: Span) => Promise<unknown>) =>
          t.startActiveSpan(name, fn),
      };
    })();

  const dateStr = yyyymmdd(Date.now());
  let stored = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    let rawScores: RawScore[] = [];

    const doScore = async (span: Span) => {
      try {
        if (deps.groqApiKey) {
          rawScores = await callGroq(batch, deps.groqApiKey, fetcher);
          span.setAttribute("nlqdb.icp.score.provider", "groq");
        } else if (deps.geminiApiKey) {
          rawScores = await callGemini(batch, deps.geminiApiKey, fetcher);
          span.setAttribute("nlqdb.icp.score.provider", "gemini");
        }
      } catch (groqErr) {
        span.recordException(groqErr as Error);
        if (deps.geminiApiKey) {
          try {
            rawScores = await callGemini(batch, deps.geminiApiKey, fetcher);
            span.setAttribute("nlqdb.icp.score.provider", "gemini-fallback");
          } catch (geminiErr) {
            span.recordException(geminiErr as Error);
            console.error(
              JSON.stringify({
                msg: "icp_score_both_failed",
                message: geminiErr instanceof Error ? geminiErr.message : String(geminiErr),
              }),
            );
          }
        }
      } finally {
        span.setAttribute("nlqdb.icp.score.batch_size", batch.length);
        span.setAttribute("nlqdb.icp.score.raw_count", rawScores.length);
        span.end();
      }
    };

    await tracer.startActiveSpan("nlqdb.icp.score", doScore);

    const itemMap = new Map(batch.map((item) => [item.id, item]));
    const writes: Promise<void>[] = [];

    for (const raw of rawScores) {
      const item = itemMap.get(raw.id);
      if (!item) continue;
      if (Math.max(raw.p1, raw.p2, raw.p3, raw.p6) < RELEVANCE_FLOOR) continue;

      const scored: IcpScoredItem = {
        source: item.source,
        id: item.id,
        url: item.url,
        title: item.title,
        ts: item.ts,
        p1: raw.p1,
        p2: raw.p2,
        p3: raw.p3,
        p6: raw.p6,
        quote: raw.quote,
      };

      writes.push(
        deps.kv
          .put(`icp:scored:${dateStr}:${item.source}:${item.id}`, JSON.stringify(scored), {
            expirationTtl: SCORED_TTL_SECONDS,
          })
          .then(() => {}),
      );
      stored++;
    }

    await Promise.all(writes);
  }

  return { scored: items.length, skipped: 0, stored };
}
