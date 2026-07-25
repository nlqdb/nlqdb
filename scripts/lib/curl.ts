// Shared HTTP transport for the operator pull scripts (gsc-pull, rum-pull).
//
// Transport is curl, not `fetch`: the daily loop runs behind a TLS-terminating
// egress proxy that bun's fetch can't traverse, but curl already trusts.
//
// The bearer token travels in argv, so it is visible to `ps` on the host for
// the life of the request — acceptable on a single-tenant CI runner or the
// founder's machine, which is the only place these scripts run.

export interface CurlResponse {
  status: number;
  body: string;
}

/** One curl round-trip; throws on transport failure, returns any HTTP status. */
export async function curlRequest(
  method: string,
  url: string,
  headers: string[],
  body?: string,
): Promise<CurlResponse> {
  const args = ["-sS", "-X", method, url, "-w", "\n%{http_code}"];
  for (const h of headers) args.push("-H", h);
  if (body !== undefined) args.push("--data-binary", body);
  const proc = Bun.spawn(["curl", ...args], { stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error(`curl ${method} ${url} failed (exit ${proc.exitCode}): ${err}`);
  }
  // `-w` appends the status on its own trailing line.
  const idx = out.lastIndexOf("\n");
  return { status: Number(out.slice(idx + 1)), body: out.slice(0, idx) };
}
