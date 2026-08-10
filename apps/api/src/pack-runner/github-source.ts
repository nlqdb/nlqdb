// Public-repository source acquisition for the repo-ops pack (D-08
// instance #1). Two REST calls to pin a commit, then one archive download
// — never one request per file.
//
// **Why the archive, not the Contents/Trees API.** Unauthenticated REST is
// 60 requests/hour per originating IP, and a Worker's egress IP is shared,
// so a per-file read loop would exhaust the budget on the first mid-sized
// repo and make the preflight fail for everyone behind that IP. The
// `codeload.github.com/<owner>/<repo>/tar.gz/<sha>` archive is the stable
// public download URL that `GET /repos/{owner}/{repo}/tarball/{ref}`
// 302-redirects to; hitting it directly costs the REST budget nothing.
// The recursive Trees API (100 000 entries / 7 MB, `truncated` when
// exceeded) could serve a count-only pass but never the file bodies, so it
// buys nothing once the archive is already being fetched.
//
// Sources checked 2026-08-10:
//   - Rate limits for the REST API — 60 req/h unauthenticated, per
//     originating IP:
//     https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
//   - Download a repository archive (tar) — 302 to the archive URL; ref
//     omitted ⇒ default branch; private-repo links expire in 5 minutes:
//     https://docs.github.com/en/rest/repos/contents#download-a-repository-archive-tar
//   - REST API endpoints for Git trees — recursive limits + `truncated`:
//     https://docs.github.com/en/rest/git/trees
//   - Compression Streams are available in the Workers runtime with no
//     compatibility flag, so gzip is decoded natively (no bundled inflate):
//     https://developers.cloudflare.com/workers/runtime-apis/web-standards/
//
// Anonymous only, by design: `SK-AUTH-008` keeps the GitHub OAuth app
// identity-only, and D-08 requires a private repo to go through a separate
// read-only GitHub App installation — a later slice. Anything this module
// cannot read anonymously returns `source_private` so the runner can route
// to that branch instead of silently widening a scope.

import { SpanStatusCode, type Tracer } from "@opentelemetry/api";

const API = "https://api.github.com";
const CODELOAD = "https://codeload.github.com";
// GitHub requires a User-Agent on every REST call.
const UA = "nlqdb-pack-runner";

export type RepoRef = { owner: string; repo: string; ref: string | null };

/**
 * Accepts what a user actually pastes: a full GitHub URL (optionally with
 * `/tree/<ref>`), a bare `owner/repo`, or either with a `.git` suffix.
 */
export function parseRepoInput(input: string): RepoRef | null {
  const trimmed = input
    .trim()
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  if (!trimmed) return null;
  const withoutHost = trimmed
    .replace(/^https?:\/\//, "")
    .replace(/^(?:www\.)?github\.com\//, "")
    .replace(/^git@github\.com:/, "");
  // Reject anything that still looks like another host.
  if (withoutHost.includes("://") || /^[^/]*\.[^/]*\//.test(withoutHost)) return null;
  const parts = withoutHost.split("/");
  const [owner, repo, kind, ...rest] = parts;
  // `owner` and `repo` are interpolated into the fixed api.github.com /
  // codeload.github.com paths, so a `.`/`..` segment would be normalised away
  // by fetch and address a *different* GitHub endpoint. GitHub has no such
  // name (and none over 100 chars), so reject both here.
  if (!isRepoName(owner) || !isRepoName(repo)) return null;
  if (parts.length === 2) return { owner, repo, ref: null };
  // `/tree/<ref>` may itself contain slashes (`release/1.x`).
  if (kind === "tree" && rest.length > 0) return { owner, repo, ref: rest.join("/") };
  return null;
}

function isRepoName(name: string | undefined): name is string {
  return !!name && name !== "." && name !== ".." && /^[A-Za-z0-9._-]{1,100}$/.test(name);
}

/** Machine codes the runner maps to a next action, never raw HTTP status. */
export type SourceFailure = "source_private" | "rate_limited" | "source_error";

export type PinResult =
  | { ok: true; commit: string; branch: string }
  | { ok: false; reason: SourceFailure };

/**
 * Resolve the default branch (or the caller's ref) to an immutable commit
 * SHA. Everything downstream reads that SHA, so a branch moving mid-import
 * cannot make the preview disagree with what was written.
 */
export async function pinCommit(
  tracer: Tracer,
  doFetch: typeof fetch,
  target: RepoRef,
): Promise<PinResult> {
  const meta = await ghJson<{ default_branch?: string; private?: boolean }>(
    tracer,
    doFetch,
    `${API}/repos/${target.owner}/${target.repo}`,
  );
  if (!meta.ok) return { ok: false, reason: meta.reason };
  const branch = target.ref ?? meta.body.default_branch;
  if (!branch) return { ok: false, reason: "source_error" };
  const commit = await ghJson<{ sha?: string }>(
    tracer,
    doFetch,
    `${API}/repos/${target.owner}/${target.repo}/commits/${encodeURIComponent(branch)}`,
  );
  if (!commit.ok) return { ok: false, reason: commit.reason };
  if (!commit.body.sha) return { ok: false, reason: "source_error" };
  return { ok: true, commit: commit.body.sha, branch };
}

type GhJson<T> = { ok: true; body: T } | { ok: false; reason: SourceFailure };

async function ghJson<T>(tracer: Tracer, doFetch: typeof fetch, url: string): Promise<GhJson<T>> {
  return tracer.startActiveSpan("nlqdb.pack.source.fetch", async (span) => {
    span.setAttribute("http.request.method", "GET");
    span.setAttribute("server.address", new URL(url).host);
    try {
      const res = await doFetch(url, {
        headers: { accept: "application/vnd.github+json", "user-agent": UA },
      });
      span.setAttribute("http.response.status_code", res.status);
      if (res.status === 403 || res.status === 429) {
        span.setAttribute("nlqdb.pack.source.outcome", "rate_limited");
        return { ok: false as const, reason: "rate_limited" as const };
      }
      // 404 on an anonymous read is indistinguishable from "private" —
      // GitHub deliberately conflates them. Route to the consent branch.
      if (res.status === 404) {
        span.setAttribute("nlqdb.pack.source.outcome", "source_private");
        return { ok: false as const, reason: "source_private" as const };
      }
      if (!res.ok) {
        span.setAttribute("nlqdb.pack.source.outcome", "source_error");
        return { ok: false as const, reason: "source_error" as const };
      }
      span.setAttribute("nlqdb.pack.source.outcome", "ok");
      return { ok: true as const, body: (await res.json()) as T };
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.setAttribute("nlqdb.pack.source.outcome", "source_error");
      return { ok: false as const, reason: "source_error" as const };
    } finally {
      span.end();
    }
  });
}

export type ArchiveEntry = {
  path: string;
  bytes: number;
  text: string | null;
  omitted?: "binary" | "too_large";
};

export type ArchiveFailure = SourceFailure | "source_too_large";

export type ArchiveResult =
  | { ok: true; entries: ArchiveEntry[] }
  | { ok: false; reason: ArchiveFailure };

/**
 * Download and expand the pinned commit's `tar.gz`. Text entries under
 * `maxItemBytes` are decoded; everything else is listed with `text: null`
 * so the classifier can skip it with an honest reason instead of the
 * runner pretending it was not there.
 */
export async function fetchArchive(
  tracer: Tracer,
  doFetch: typeof fetch,
  target: RepoRef,
  commit: string,
  limits: { maxItems: number; maxItemBytes: number; maxTotalBytes: number },
): Promise<ArchiveResult> {
  return tracer.startActiveSpan("nlqdb.pack.source.archive", async (span) => {
    const url = `${CODELOAD}/${target.owner}/${target.repo}/tar.gz/${commit}`;
    span.setAttribute("server.address", new URL(url).host);
    span.setAttribute("nlqdb.pack.source.commit", commit);
    try {
      const res = await doFetch(url, { headers: { "user-agent": UA } });
      span.setAttribute("http.response.status_code", res.status);
      if (res.status === 404) return fail(span, "source_private");
      if (res.status === 429) return fail(span, "rate_limited");
      if (!res.ok || !res.body) return fail(span, "source_error");
      const entries = await readTarGz(res.body, limits);
      if (!entries.ok) return fail(span, entries.reason);
      span.setAttribute("nlqdb.pack.source.entries", entries.entries.length);
      span.setAttribute("nlqdb.pack.source.outcome", "ok");
      return { ok: true as const, entries: entries.entries };
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      return fail(span, "source_error");
    } finally {
      span.end();
    }
  });
}

function fail(span: { setAttribute: (k: string, v: string) => void }, reason: ArchiveFailure) {
  span.setAttribute("nlqdb.pack.source.outcome", reason);
  return { ok: false as const, reason };
}

// ── tar.gz reader ─────────────────────────────────────────────────────
//
// gzip is decoded by the runtime's `DecompressionStream` (no bundled
// inflate — GLOBAL-013 bundle budget). What remains is POSIX tar: 512-byte
// header blocks, name at 0, size at 124 (octal), type at 156, payload
// padded to 512. GNU long names arrive as a type-`L` entry whose payload is
// the next entry's name. That is the whole format we need, so it is ~50
// lines here rather than a dependency.

const BLOCK = 512;
const EMPTY = new Uint8Array(0);

export async function readTarGz(
  body: ReadableStream<Uint8Array>,
  limits: { maxItems: number; maxItemBytes: number; maxTotalBytes: number },
): Promise<
  { ok: true; entries: ArchiveEntry[] } | { ok: false; reason: "source_too_large" | "source_error" }
> {
  // `DecompressionStream`'s writable side is typed `BufferSource` in
  // workers-types while `body` is a `Uint8Array` stream; the cast is the
  // variance mismatch only — the runtime pair is exactly this.
  const stream = body.pipeThrough(
    new DecompressionStream("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
  );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  // The archive is compressed; the cap is on the *expanded* bytes, which is
  // what actually costs Worker memory.
  const hardCap = limits.maxTotalBytes;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > hardCap) {
      await reader.cancel();
      return { ok: false, reason: "source_too_large" };
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let at = 0;
  // Drop each chunk's reference as it is copied, so the expanded archive is
  // held once rather than twice — `maxTotalBytes` is sized against the
  // isolate's memory ceiling and a second live copy would double it.
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    buf.set(chunk, at);
    at += chunk.byteLength;
    chunks[i] = EMPTY;
  }
  return { ok: true, entries: parseTar(buf, limits) };
}

export function parseTar(
  buf: Uint8Array,
  limits: { maxItems: number; maxItemBytes: number },
): ArchiveEntry[] {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const entries: ArchiveEntry[] = [];
  let offset = 0;
  let longName: string | null = null;

  while (offset + BLOCK <= buf.byteLength && entries.length < limits.maxItems) {
    const header = buf.subarray(offset, offset + BLOCK);
    // Two consecutive zero blocks terminate the archive; one is enough here.
    if (header.every((b) => b === 0)) break;
    const rawName = cstr(decoder, header.subarray(0, 100));
    const size = Number.parseInt(cstr(decoder, header.subarray(124, 136)).trim() || "0", 8) || 0;
    const type = String.fromCharCode(header[156] ?? 0);
    const payloadStart = offset + BLOCK;
    const payload = buf.subarray(payloadStart, payloadStart + size);
    offset = payloadStart + Math.ceil(size / BLOCK) * BLOCK;

    if (type === "L") {
      longName = cstr(decoder, payload);
      continue;
    }
    const name = longName ?? rawName;
    longName = null;
    // Regular files only ("0" or NUL); directories, symlinks, pax headers out.
    if (type !== "0" && type !== "\0") continue;
    // Archives are rooted at `<repo>-<sha>/`; strip that one leading segment
    // so paths read as they do in the repository.
    const path = name.split("/").slice(1).join("/");
    if (!path) continue;
    // Distinguish "we capped it" from "it is not text": the classifier turns
    // this into the reason the user actually reads.
    const omitted =
      size > limits.maxItemBytes ? "too_large" : isProbablyText(payload) ? undefined : "binary";
    entries.push({
      path,
      bytes: size,
      text: omitted ? null : decoder.decode(payload),
      ...(omitted ? { omitted } : {}),
    });
  }
  return entries;
}

function cstr(decoder: TextDecoder, bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  return decoder.decode(end === -1 ? bytes : bytes.subarray(0, end));
}

/** A NUL byte in the first KiB is the cheap, reliable binary tell. */
function isProbablyText(bytes: Uint8Array): boolean {
  return bytes.subarray(0, 1024).indexOf(0) === -1;
}
