// Build-time, dependency-free syntax highlighter. Runs in Astro's
// frontmatter, emits HTML strings with `tk-*` token spans. Only as
// accurate as it needs to be for the snippets we ship — see
// `data/snippets.ts`. The tokenizers are deliberately not state-of-
// the-art; if they break on a new snippet, fix the snippet or extend
// the rules locally.

export type Lang = "bash" | "html" | "ts";

type Token = readonly [type: string, text: string];

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const renderTokens = (toks: readonly Token[]): string =>
  toks
    .map(([t, s]) => (t === "_" ? escapeHtml(s) : `<span class="tk-${t}">${escapeHtml(s)}</span>`))
    .join("");

// ─── Bash ──────────────────────────────────────────────────────────
// Comments + double-quoted strings + a curated allow-list of command
// names. Bash without context is hard; the allow-list keeps us honest.

const BASH_COMMANDS = new Set([
  "curl",
  "nlq",
  "brew",
  "npm",
  "sh",
  "git",
  "echo",
  "cat",
  "ls",
  "cd",
]);

function tokenizeBash(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    // line comment — only at start-of-line (after newline or BOF)
    if (c === "#" && (i === 0 || src[i - 1] === "\n")) {
      const nl = src.indexOf("\n", i);
      const j = nl === -1 ? src.length : nl;
      out.push(["c", src.slice(i, j)]);
      i = j;
      continue;
    }
    // double-quoted string (the only string form our snippets use)
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') {
        if (src[j] === "\\" && j + 1 < src.length) j++;
        j++;
      }
      j = Math.min(j + 1, src.length);
      out.push(["s", src.slice(i, j)]);
      i = j;
      continue;
    }
    // identifier — known command name in command position becomes `fn`
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[\w-]/.test(src[j])) j++;
      const word = src.slice(i, j);
      const atCmdPos = i === 0 || src[i - 1] === "\n" || /[\s|;&(]/.test(src[i - 1]);
      if (atCmdPos && BASH_COMMANDS.has(word)) out.push(["fn", word]);
      else out.push(["_", word]);
      i = j;
      continue;
    }
    out.push(["_", c]);
    i++;
  }
  return out;
}

// ─── TypeScript / JavaScript ───────────────────────────────────────

const TS_KEYWORDS = new Set([
  "import",
  "from",
  "const",
  "let",
  "var",
  "await",
  "async",
  "function",
  "return",
  "if",
  "else",
  "true",
  "false",
  "null",
  "undefined",
  "new",
  "typeof",
  "as",
  "default",
  "export",
]);

function tokenizeTs(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    // line comment
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      const j = nl === -1 ? src.length : nl;
      out.push(["c", src.slice(i, j)]);
      i = j;
      continue;
    }
    // block comment
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const j = end === -1 ? src.length : end + 2;
      out.push(["c", src.slice(i, j)]);
      i = j;
      continue;
    }
    // strings — single, double, template
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      let j = i + 1;
      while (j < src.length && src[j] !== q) {
        if (src[j] === "\\" && j + 1 < src.length) j++;
        j++;
      }
      j = Math.min(j + 1, src.length);
      out.push(["s", src.slice(i, j)]);
      i = j;
      continue;
    }
    // identifier
    if (/[a-zA-Z_$]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[\w$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (TS_KEYWORDS.has(word)) out.push(["k", word]);
      else if (src[j] === "(") out.push(["fn", word]);
      else if (word.length > 1 && /^[A-Z][A-Z0-9_]*$/.test(word))
        out.push(["v", word]); // SCREAMING_SNAKE → env-var-ish
      else out.push(["_", word]);
      i = j;
      continue;
    }
    out.push(["_", c]);
    i++;
  }
  return out;
}

// ─── HTML ──────────────────────────────────────────────────────────
// Minimal state machine: outside-tag plaintext, comments, and
// inside-tag {tag-name, attribute, attr-value-string, brackets}.

function tokenizeHtml(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let inTag = false;
  let firstIdInTag = false;
  while (i < src.length) {
    // comment
    if (!inTag && src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      const j = end === -1 ? src.length : end + 3;
      out.push(["c", src.slice(i, j)]);
      i = j;
      continue;
    }
    // tag open
    if (!inTag && src[i] === "<" && /[a-zA-Z/]/.test(src[i + 1] ?? "")) {
      inTag = true;
      firstIdInTag = true;
      if (src[i + 1] === "/") {
        out.push(["pn", "</"]);
        i += 2;
      } else {
        out.push(["pn", "<"]);
        i += 1;
      }
      continue;
    }
    // tag close
    if (inTag && (src[i] === ">" || src.startsWith("/>", i))) {
      const tk = src[i] === ">" ? ">" : "/>";
      out.push(["pn", tk]);
      i += tk.length;
      inTag = false;
      continue;
    }
    // attr-value string inside tag
    if (inTag && src[i] === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j++;
      j = Math.min(j + 1, src.length);
      out.push(["s", src.slice(i, j)]);
      i = j;
      continue;
    }
    // identifier inside tag — first one is the tag name, rest are attrs
    if (inTag && /[a-zA-Z]/.test(src[i])) {
      let j = i + 1;
      while (j < src.length && /[\w-]/.test(src[j])) j++;
      const word = src.slice(i, j);
      out.push([firstIdInTag ? "t" : "a", word]);
      firstIdInTag = false;
      i = j;
      continue;
    }
    out.push(["_", src[i]]);
    i++;
  }
  return out;
}

// ─── Public ────────────────────────────────────────────────────────

const TOKENIZERS: Record<Lang, (src: string) => Token[]> = {
  bash: tokenizeBash,
  ts: tokenizeTs,
  html: tokenizeHtml,
};

export function highlight(lang: Lang, src: string): string {
  return renderTokens(TOKENIZERS[lang](src));
}
