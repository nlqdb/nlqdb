#!/usr/bin/env node
// Free-chain health probe — answers the single most-asked /daily question:
// "which free LLM providers are live right now, and how fast?"
//
// The 2026-06-12 Spider baseline's `no_sql` losses were root-caused to
// provider failures (`gemini:http_4xx`, `mistral:network`), not prompt or
// schema-size problems. Telling a dead key from a transient blip used to mean
// reconstructing an ad-hoc curl each run. This script makes that one command,
// probing the EXACT planner-tier (`plan` op) model IDs each provider uses in
// prod (apps/api/src/llm-router.ts chains) so the signal matches the engine.
//
// Direct upstream probe (not via CF AI Gateway): the gateway only proxies
// auth, so a 200/401/403/429 from the upstream is the true key/quota signal.
// Read-only, ~10 tokens/provider, no side effects. Run: node scripts/probe-free-chain.mjs

const PROBE = "Reply with exactly: OK";

// Planner-tier (`plan`) model IDs — see DEFAULT_MODELS in each
// packages/llm/src/providers/<name>.ts. The planner tier drives EX, so its
// health is what the Spider/BIRD numbers actually ride on.
const OPENAI_COMPATIBLE = [
  {
    name: "cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    key: process.env.CEREBRAS_API_KEY,
    model: "gpt-oss-120b",
  },
  {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
  },
  {
    name: "openrouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: process.env.OPENROUTER_API_KEY,
    model: "qwen/qwen3-coder:free",
  },
  {
    name: "mistral",
    url: "https://api.mistral.ai/v1/chat/completions",
    key: process.env.MISTRAL_API_KEY,
    model: "mistral-large-latest",
  },
];

async function probeOpenAI({ name, url, key, model }) {
  if (!key) return { name, model, status: "NO_KEY", ms: 0, note: "env key unset" };
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: PROBE }], max_tokens: 10 }),
    });
    const ms = Date.now() - t0;
    const body = await r.text();
    return { name, model, status: r.status, ms, note: r.ok ? "" : oneLine(body) };
  } catch (e) {
    return { name, model, status: "ERR", ms: Date.now() - t0, note: e.message };
  }
}

async function probeGemini() {
  const key = process.env.GEMINI_API_KEY;
  const model = "gemini-2.5-flash"; // gemini DEFAULT_MODELS.plan
  if (!key) return { name: "gemini", model, status: "NO_KEY", ms: 0, note: "env key unset" };
  const t0 = Date.now();
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: PROBE }] }] }),
      },
    );
    const ms = Date.now() - t0;
    const body = await r.text();
    return { name: "gemini", model, status: r.status, ms, note: r.ok ? "" : oneLine(body) };
  } catch (e) {
    return { name: "gemini", model, status: "ERR", ms: Date.now() - t0, note: e.message };
  }
}

const oneLine = (s) => s.replace(/\s+/g, " ").slice(0, 90);

const results = await Promise.all([...OPENAI_COMPATIBLE.map(probeOpenAI), probeGemini()]);

let healthy = 0;
console.info(`free-chain probe — ${new Date().toISOString()}`);
console.info("provider     status  latency  model / note");
for (const r of results) {
  const ok = r.status === 200;
  if (ok) healthy++;
  const lat = r.ms ? `${r.ms}ms` : "-";
  console.info(
    `${r.name.padEnd(12)} ${String(r.status).padEnd(6)} ${lat.padEnd(8)} ${r.model}${r.note ? `  — ${r.note}` : ""}`,
  );
}
console.info(`\nhealthy planner-tier providers: ${healthy}/${results.length}`);
// Exit non-zero only if the whole chain is down — a single dead leg is
// expected (the chain fails over) and must not break a CI smoke.
process.exit(healthy === 0 ? 1 : 0);
