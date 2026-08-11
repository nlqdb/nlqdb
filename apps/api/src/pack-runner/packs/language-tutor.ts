// Goal pack #2, **language-tutor** (EK-04, `SK-EKP-004`): the pilot
// "become AI" expert pack as instance #2 of the shared pack runner
// (D-08 / `SK-PIVOT-021`). It proves the runner's N+1 claim — a second
// pack supplies only its source, its eligibility judgment and its row
// vocabulary; the journey (draft → phases → real counters → durable proof
// → delete) is the runner's and is not touched here.
//
// **The source is an interview session** (`SK-EKP-007`, EK-01's design
// record). The ACTA question engine and its structured-output extraction
// run in the private `experts` product (`SK-EKP-003`); they hand nlqdb a
// completed transcript — per exchange, the plain-language episode plus the
// entity/fact rows that exchange produced. The LLM that read the expert's
// answers is the interview model on the expert's OWN tenant
// (`INV-EKP-037`): **this module is pure and never calls a model.** It maps
// an already-extracted transcript into `agent_memory_v1` rows, each fact
// carrying `source_episode` provenance (the Graphiti/Zep pattern,
// `SK-EKP-007` stake 2). Because the mapping is pure, an interview cell
// value never reaches an LLM through this path — the query path stays the
// unmodified `GLOBAL-037` schema-only builder.
//
// The row vocabulary is fixed by the `SK-QUAL-023` language-tutor eval
// corpus (`tools/eval/src/datasets/memory-quality.ts`,
// `language_tutor_memory_v1`) so the pack writes exactly the shape the
// golden queries read: entity kinds `word` / `grammar_rule` / `topic` /
// `student`; fact kinds `mistake` / `vocab_encounter` / `student_profile`
// / `pricing_heuristic` / `retired`; episode role `lesson`. Inventing names
// here would silently un-answer the golds that gate the pack.
//
// A pack adds **no** endpoint, DDL, preset version or MCP tool
// (`SK-PIVOT-018`): every row it produces is an `nlqdb_remember` payload
// the existing write verb already accepts, and secret-shaped values are
// dropped centrally by the runner's guard (no pack opt-out).

import { SpanStatusCode } from "@opentelemetry/api";
import type {
  AcquireResult,
  ClassifyResult,
  MemoryRecord,
  PackAdapter,
  PackContext,
  SkipReason,
  SourceDescriptor,
  SourceItem,
  SourceParse,
} from "../types.ts";

// ── the interview-session seam (EK-04 owns the nlqdb side) ─────────────
//
// The wire shape `experts` hands nlqdb. Kept deliberately small: an exchange
// is its episode text plus the rows the interview already extracted from it.
// `experts` owns producing valid vocabulary; nlqdb owns mapping it faithfully
// onto `agent_memory_v1` with provenance — it does not re-run extraction.

export type InterviewExtraction =
  | { object: "entity"; kind: string; name: string }
  | { object: "fact"; kind: string; content: string; tags?: string[] };

export type InterviewExchange = {
  /** Stable identity within the session; the skip key and the episode's provenance. */
  id: string;
  /** Episode role; the corpus uses `lesson`. */
  role?: string;
  /** Plain-language summary of the exchange — the episode row, kept always. */
  episode: string;
  /** Rows the interview's structured-output step extracted from this exchange. */
  extractions?: InterviewExtraction[];
};

export type InterviewTranscript = {
  sessionId: string;
  exchanges: InterviewExchange[];
};

// The hosted interview service that serves a completed session's transcript
// (the `experts` deployment, `SK-EKP-003`). The origin is finalised with
// EK-05's `experts` wiring; until then `acquire`'s live path is exercised
// only through an injected `fetch` (the EK-04 "runner executes an
// interview-sourced import end-to-end" box stays open until the endpoint is
// live). `sessionId` is validated before it reaches the URL, so the built
// path is bounded.
const TRANSCRIPT_BASE = "https://experts.nlqdb.com/v1/interview-sessions";

const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/** `interview:<id>` or a bare id → the credential-free session id, else null. */
export function parseSessionRef(input: string): string | null {
  const id = input.trim().replace(/^interview:/i, "");
  return SESSION_ID.test(id) ? id : null;
}

function decodeExchange(text: string | null): InterviewExchange | null {
  if (text === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const ex = parsed as Record<string, unknown>;
  if (typeof ex["id"] !== "string" || typeof ex["episode"] !== "string" || !ex["episode"].trim()) {
    return null;
  }
  return parsed as InterviewExchange;
}

function decodeTranscript(body: unknown): InterviewTranscript | null {
  if (typeof body !== "object" || body === null) return null;
  const t = body as Record<string, unknown>;
  if (typeof t["sessionId"] !== "string" || !Array.isArray(t["exchanges"])) return null;
  return body as InterviewTranscript;
}

// ── extraction (pure — no model, no network) ───────────────────────────

/**
 * A well-formed extraction element. `extractions` crosses the HTTP seam
 * from the `experts` service, so each element is validated here — the same
 * defensive posture `decodeExchange` takes for `id`/`episode`. A malformed
 * element is dropped (the episode is still kept) rather than written as an
 * undefined-valued row or thrown over the whole import.
 */
function validExtraction(ex: unknown): ex is InterviewExtraction {
  if (typeof ex !== "object" || ex === null) return false;
  const e = ex as Record<string, unknown>;
  if (e["object"] === "entity")
    return typeof e["kind"] === "string" && typeof e["name"] === "string";
  if (e["object"] === "fact")
    return typeof e["kind"] === "string" && typeof e["content"] === "string";
  return false;
}

/** One exchange → its episode row plus the entity/fact rows it extracted. */
export function exchangeRecords(exchange: InterviewExchange, sessionId: string): MemoryRecord[] {
  // The episode is kept even when nothing structured extracts (SK-EKP-007
  // stake 2): the conversation itself is memory.
  const records: MemoryRecord[] = [
    {
      category: "lesson_episode",
      object: "episode",
      payload: { role: exchange.role ?? "lesson", content: exchange.episode },
    },
  ];
  // `source_episode` provenance rides the fact's `source` (the same place
  // repo-ops keys its provenance): the public `nlqdb_remember` contract has
  // no edge verb yet, so the fact→episode link is metadata, not an
  // `entity_facts` row (the D-08 edge-verb gap). The entity anchor (the word
  // or rule slipped on) rides `tags`, exactly as the eval corpus tags it.
  const extractions = Array.isArray(exchange.extractions) ? exchange.extractions : [];
  for (const ex of extractions) {
    if (!validExtraction(ex)) continue;
    if (ex.object === "entity") {
      records.push({
        category: ex.kind,
        object: "entity",
        payload: { kind: ex.kind, canonical_name: ex.name },
      });
    } else {
      records.push({
        category: ex.kind,
        object: "fact",
        payload: {
          content: ex.content,
          kind: ex.kind,
          tags: Array.isArray(ex.tags) ? ex.tags : [],
          source: { session: sessionId, source_episode: exchange.id },
        },
      });
    }
  }
  return records;
}

// ── the adapter ───────────────────────────────────────────────────────

export const languageTutorPack: PackAdapter = {
  id: "language-tutor",
  preset: "agent_memory_v1",
  label: "Import interview knowledge",
  // A proof subset answerable over the imported rows as written — facts by
  // `kind` with the anchor in `tags`, and episodes by `role`. The
  // spaced-repetition (`expires_at`) and entity-join golds in the eval family
  // need the pack to set a TTL and write edges, neither of which the public
  // `nlqdb_remember` contract exposes yet (the D-08 gaps), so they stay in the
  // eval corpus and out of the runner's live proof until those verbs land.
  goldenQueries: [
    "List the tutor's pricing heuristics.",
    "What is the student's current level?",
    "List the tutor's lesson sessions in chronological order — what each covered and when.",
    "Which grammar rules has the student most often slipped on? Show the rule and the count, most first.",
  ],

  parseSource(input: string): SourceParse {
    const sessionId = parseSessionRef(input);
    if (!sessionId) {
      return {
        ok: false,
        reason:
          "Paste the interview session reference (for example `interview:abc123`) from your completed session.",
      };
    }
    return {
      ok: true,
      source: {
        kind: "interview-session",
        ref: `interview session ${sessionId}`,
        pin: null,
        meta: { sessionId },
      },
    };
  },

  async acquire(source: SourceDescriptor, ctx: PackContext): Promise<AcquireResult> {
    const sessionId = source.meta["sessionId"];
    if (!sessionId || !SESSION_ID.test(sessionId)) return { ok: false, reason: "source_error" };
    const url = `${TRANSCRIPT_BASE}/${sessionId}/transcript`;

    // GLOBAL-014: the one external call hangs its span off the runner's tracer.
    const fetched = await ctx.tracer.startActiveSpan(
      "nlqdb.pack.source.fetch",
      async (span): Promise<AcquireResult | { ok: true; transcript: InterviewTranscript }> => {
        span.setAttribute("http.request.method", "GET");
        span.setAttribute("server.address", new URL(url).host);
        try {
          const res = await ctx.fetch(url, { headers: { accept: "application/json" } });
          span.setAttribute("http.response.status_code", res.status);
          if (!res.ok) {
            // The runner maps `source_private` to the consent branch and
            // `rate_limited` to retry; everything else fails loud.
            const reason =
              res.status === 401 || res.status === 403
                ? "source_private"
                : res.status === 429
                  ? "rate_limited"
                  : res.status === 404
                    ? "source_not_found"
                    : "source_error";
            span.setAttribute("nlqdb.pack.source.outcome", reason);
            return { ok: false, reason };
          }
          const transcript = decodeTranscript(await res.json().catch(() => null));
          if (!transcript) {
            span.setAttribute("nlqdb.pack.source.outcome", "source_malformed");
            return { ok: false, reason: "source_malformed" };
          }
          span.setAttribute("nlqdb.pack.source.outcome", "ok");
          return { ok: true, transcript };
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
          span.setAttribute("nlqdb.pack.source.outcome", "source_error");
          return { ok: false, reason: "source_error" };
        } finally {
          span.end();
        }
      },
    );
    if (!fetched.ok || !("transcript" in fetched)) return fetched as AcquireResult;

    // A completed session is immutable, so pinning to its id makes every
    // retry read the same bytes the preview described.
    const items: SourceItem[] = [];
    for (const exchange of fetched.transcript.exchanges.slice(0, ctx.limits.maxItems)) {
      const text = JSON.stringify(exchange);
      const bytes = text.length;
      if (bytes > ctx.limits.maxItemBytes) {
        items.push({ id: exchange.id, bytes, text: null, omitted: "too_large" });
      } else {
        items.push({ id: exchange.id, bytes, text });
      }
    }
    return { ok: true, source: { ...source, pin: sessionId }, items };
  },

  classify(items: SourceItem[]): ClassifyResult {
    const eligible: SourceItem[] = [];
    const skipped: { id: string; reason: SkipReason }[] = [];
    for (const item of items) {
      // Every real exchange is eligible: its episode is memory even when the
      // interview extracted no structured rows (SK-EKP-007 stake 2). Only a
      // capped or malformed exchange is skipped, with the honest reason.
      if (item.text === null) {
        skipped.push({ id: item.id, reason: "too_large" });
      } else if (decodeExchange(item.text) === null) {
        skipped.push({ id: item.id, reason: "no_extractable_structure" });
      } else {
        eligible.push(item);
      }
    }
    return { eligible, skipped };
  },

  extract(items: SourceItem[], source: SourceDescriptor): MemoryRecord[] {
    const sessionId = source.meta["sessionId"] ?? source.pin ?? "";
    const records: MemoryRecord[] = [];
    for (const item of items) {
      const exchange = decodeExchange(item.text);
      if (exchange) records.push(...exchangeRecords(exchange, sessionId));
    }
    return records;
  },
};
