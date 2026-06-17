// SK-LLM-037 — goal-relevant schema pruning for the planner prompt.
//
// Recall-first, table-granular: keep every CREATE TABLE/VIEW whose name
// or column identifiers share a token with the goal, then close the join
// graph both ways — a kept table's FOREIGN KEY ... REFERENCES parents, plus
// any bridge table that references two-or-more kept tables (the many-to-many
// link a token match never reaches). Anything ambiguous keeps the full schema
// — missing a needed table is far worse for SQL generation than sending extras
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

  // Join-path closure to a fixpoint, two recall-first rules:
  //  (1) Parent FK — a kept table's REFERENCES targets must be present so
  //      the model can join through them.
  //  (2) Bridge — a table that REFERENCES two or more already-kept tables
  //      is the join path between them (a many-to-many link table whose own
  //      name/columns share no goal token, so rule-1 never reaches it). Keep
  //      it; the path A→link→B is unplannable without it. Requiring ≥2 kept
  //      references bounds this to genuine bridges, not every child row.
  const byName = new Map(tables.map((t) => [t.name as string, t]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of [...kept]) {
      const t = byName.get(name);
      if (!t) continue;
      for (const ref of t.references) {
        if (!kept.has(ref) && byName.has(ref)) {
          kept.add(ref);
          changed = true;
        }
      }
    }
    for (const t of tables) {
      if (kept.has(t.name as string)) continue;
      const linked = new Set(t.references.filter((r) => kept.has(r)));
      if (linked.size >= 2) {
        kept.add(t.name as string);
        changed = true;
      }
    }
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
