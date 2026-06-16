// SK-LLM-037 — goal-relevant schema pruning for the planner prompt.
// SK-LLM-040 — bridge-table closure (keep the M:N junction below).
//
// Recall-first, table-granular: keep every CREATE TABLE/VIEW whose name
// or column identifiers share a token with the goal, then close over
// their FOREIGN KEY ... REFERENCES targets so a kept table's joins stay
// plannable. Anything ambiguous keeps the full schema — missing a needed
// table is far worse for SQL generation than sending extra ones
// (RSL-SQL arXiv:2411.00073; arXiv:2408.07702 measures the same
// asymmetry). Pure + zero-dep so production `/v1/ask` and the eval
// harness share it byte-for-byte through `buildPlanUser`.

// Below either floor a prompt is already cheap — pruning would add
// recall risk for no measurable token win.
const MIN_TABLES = 5;
const MIN_SCHEMA_CHARS = 2000;
// When pruning keeps almost everything, send the original text instead —
// identical content, zero re-assembly risk.
const MAX_KEPT_RATIO = 0.9;

// Identifier/goal tokens shorter than this are noise (`id`, `is`, `of`).
const MIN_TOKEN_LEN = 3;

type Statement = {
  raw: string;
  // Lowercased bare table/view name; null for non-CREATE statements
  // (indexes, triggers) which are always kept with their neighbours.
  name: string | null;
  tokens: Set<string>;
  references: string[];
};

// `"name"` / `` `name` `` / `[name]` / bare — the four quoting forms the
// dialects we plan for emit.
const CREATE_NAME_RE =
  /CREATE\s+(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))/i;
const REFERENCES_RE = /REFERENCES\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))/gi;

function quotedName(m: RegExpMatchArray): string {
  return (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").toLowerCase();
}

// Split an identifier (or goal text) into comparable word tokens:
// `FreeMealCount`, `free_meal_count` and "free meal count" all yield
// {free, meal, count}. A trailing `s` is stripped so singular/plural
// goal wording still matches (`drivers` table ↔ "driver").
export function wordTokens(text: string): Set<string> {
  const out = new Set<string>();
  const split = text
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z\d]+/);
  for (const t of split) {
    if (t.length < MIN_TOKEN_LEN) continue;
    out.add(t);
    if (t.length > MIN_TOKEN_LEN && t.endsWith("s")) out.add(t.slice(0, -1));
  }
  return out;
}

// Identifier tokens of one CREATE statement: the table/view name plus
// every column name (the first identifier of each top-level
// comma-separated body segment that is not a table-constraint keyword).
const CONSTRAINT_KEYWORDS = new Set(["constraint", "primary", "foreign", "unique", "check", "key"]);

function statementTokens(raw: string, name: string): Set<string> {
  const tokens = wordTokens(name);
  const open = raw.indexOf("(");
  const close = raw.lastIndexOf(")");
  if (open === -1 || close <= open) return tokens;
  const body = raw.slice(open + 1, close);
  let depth = 0;
  let segment = "";
  const segments: string[] = [];
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      segments.push(segment);
      segment = "";
    } else segment += ch;
  }
  segments.push(segment);
  for (const seg of segments) {
    const m = seg.match(/^\s*(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))/);
    if (!m) continue;
    const first = quotedName(m);
    if (CONSTRAINT_KEYWORDS.has(first)) continue;
    for (const t of wordTokens(m[1] ?? m[2] ?? m[3] ?? m[4] ?? "")) tokens.add(t);
  }
  return tokens;
}

function parseStatements(schema: string): Statement[] {
  // DDL statements end `;\n` (sqlite_master join + our compiled
  // schema_text both use it); a final statement may omit the semicolon.
  return schema
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const created = raw.match(CREATE_NAME_RE);
      const name = created ? quotedName(created) : null;
      const references: string[] = [];
      for (const m of raw.matchAll(REFERENCES_RE)) references.push(quotedName(m));
      return {
        raw,
        name,
        tokens: name ? statementTokens(raw, name) : new Set<string>(),
        references,
      };
    });
}

// Prune `schema` to the tables the goal plausibly needs. Falls back to
// the original text whenever the conservative path is not a clear win.
export function pruneSchemaForGoal(schema: string, goal: string): string {
  if (schema.length < MIN_SCHEMA_CHARS) return schema;
  const statements = parseStatements(schema);
  const tables = statements.filter((s) => s.name !== null);
  if (tables.length < MIN_TABLES) return schema;

  const goalTokens = wordTokens(goal);
  const kept = new Set<string>();
  for (const t of tables) {
    for (const token of t.tokens) {
      if (goalTokens.has(token)) {
        kept.add(t.name as string);
        break;
      }
    }
  }
  if (kept.size === 0) return schema;

  // FK closure — a kept table's REFERENCES targets must be present for
  // the model to join through them.
  const byName = new Map(tables.map((t) => [t.name as string, t]));
  const queue = [...kept];
  while (queue.length > 0) {
    const t = byName.get(queue.pop() as string);
    if (!t) continue;
    for (const ref of t.references) {
      if (!kept.has(ref) && byName.has(ref)) {
        kept.add(ref);
        queue.push(ref);
      }
    }
  }

  // SK-LLM-040 — bridge/junction closure. A non-kept table that
  // REFERENCES ≥ 2 distinct kept tables is the M:N join table (e.g.
  // `roles(mid, aid)`, `student_course`) connecting two already-relevant
  // entities. Its own name + FK columns are often abbreviated (`mid`,
  // `aid`) and don't token-match the goal, so the forward closure above
  // misses it — and without the junction the planner can't write the
  // join. Adding it is high-precision: a table that joins two relevant
  // tables is almost certainly the path between them (RSL-SQL
  // arXiv:2411.00073). Evaluated against the pre-bridge `kept` set so the
  // pass is single-shot and order-independent (no cascade); the
  // MAX_KEPT_RATIO guard below still bounds any over-inclusion.
  const seedKept = new Set(kept);
  for (const t of tables) {
    if (seedKept.has(t.name as string)) continue;
    const linkedKept = new Set(t.references.filter((r) => seedKept.has(r)));
    if (linkedKept.size >= 2) kept.add(t.name as string);
  }

  // Non-CREATE statements ride along only when their text names a kept
  // table; statements we can't attribute are kept (recall-first).
  const keptStatements = statements.filter((s) => {
    if (s.name !== null) return kept.has(s.name);
    const lower = s.raw.toLowerCase();
    return [...byName.keys()].every((n) => kept.has(n) || !lower.includes(n));
  });

  const pruned = keptStatements.map((s) => s.raw).join(";\n\n");
  if (pruned.length >= schema.length * MAX_KEPT_RATIO) return schema;
  return pruned;
}
