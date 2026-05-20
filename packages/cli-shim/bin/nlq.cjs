#!/usr/bin/env node
// Thin wrapper so `npm bin` resolves `nlq` on every platform; the real binary
// is downloaded by scripts/postinstall.mjs into the same directory.
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ext = process.platform === "win32" ? ".exe" : "";
const bin = path.join(__dirname, `nlq-bin${ext}`);

if (!fs.existsSync(bin)) {
  process.stderr.write(
    "nlq: binary missing — re-run `npm install -g @nlqdb/cli`, or " +
      "set NLQDB_CLI_SKIP_DOWNLOAD=0 and reinstall to fetch it.\n",
  );
  process.exit(1);
}

const result = spawnSync(bin, process.argv.slice(2), { stdio: "inherit" });
if (result.error) {
  process.stderr.write(`nlq: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
