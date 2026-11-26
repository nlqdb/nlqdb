// The one answer to "does npm serve this workspace package?", shared by
// sync-readme-packages.mjs and the npm-surface integrity tests. npm's own gate
// is `private: true`, but `@nlqdb/cli` is `private` in-repo only so changesets
// skips it: release-npm.yml's `cli-shim` job publishes it per CLI release
// (SK-CLI-002).
const PUBLISHED_OUTSIDE_CHANGESETS = new Set(["@nlqdb/cli"]);

/** @param {{ name?: string, private?: boolean }} manifest */
export function servedByNpm(manifest) {
  return manifest.private !== true || PUBLISHED_OUTSIDE_CHANGESETS.has(manifest.name ?? "");
}
