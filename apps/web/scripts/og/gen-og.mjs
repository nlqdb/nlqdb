// Build-time OG/social-card generator for the agent-memory wedge surfaces
// (agent-memory-pivot WS-08, SK-PIVOT-012). Hand-authored SVG → PNG via
// @resvg/resvg-js. Brand: acid lime (#c6f432) on near-black (#0b0f0a),
// JetBrains Mono, thick borders + one hard shadow — type only, NO
// screenshots / stock (SK-PIVOT-004, manifesto tenet 08).
//
// This is a MANUALLY-RUN one-off — it is deliberately NOT wired into
// `astro build`, so neither the rasteriser nor the font binaries reach
// the Cloudflare free-tier build/Worker path (GLOBAL-013). The rendered
// PNGs in `public/og/` are the committed artifact; re-run only when a
// card's copy changes:
//
//   bun run --filter @nlqdb/web og:gen
//
// Outputs 1200×630 cards into apps/web/public/og/.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(here, "fonts");
const outDir = join(here, "..", "..", "public", "og");
mkdirSync(outDir, { recursive: true });

const fontBuffers = [
  readFileSync(join(fontsDir, "JetBrainsMono-Regular.ttf")),
  readFileSync(join(fontsDir, "JetBrainsMono-Bold.ttf")),
  readFileSync(join(fontsDir, "JetBrainsMono-ExtraBold.ttf")),
];

const BG = "#0b0f0a";
const ELEV = "#131811";
const ACCENT = "#c6f432";
const FG = "#f4f4f0";
const DIM = "#a8a8a0";
const FRAME = "#2a3320";

const W = 1200;
const H = 630;
const PAD = 84;
const FAMILY = "JetBrains Mono";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// JetBrains Mono advance ≈ 0.6em; only used to size the hard-shadow chip box.
const chipWidth = (s, size) => s.length * size * 0.6 + 44;

function chip(x, y, label, size = 26) {
  const h = size + 28;
  const w = chipWidth(label, size);
  const off = 8;
  return `
    <rect x="${x + off}" y="${y + off}" width="${w}" height="${h}" fill="${FG}" />
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${ACCENT}" />
    <text x="${x + 22}" y="${y + h / 2}" font-family="${FAMILY}" font-weight="700"
      font-size="${size}" fill="${BG}" dominant-baseline="central">${esc(label)}</text>`;
}

// One title line = sequential <tspan>s inside a single <text>, so resvg lays
// out advances itself (no manual width math). seg = {t, accent?}.
function titleLine(segments, y, size) {
  const spans = segments
    .map((s) => `<tspan fill="${s.accent ? ACCENT : FG}">${esc(s.t)}</tspan>`)
    .join("");
  return `<text x="${PAD}" y="${y}" font-family="${FAMILY}" font-weight="800"
    font-size="${size}" letter-spacing="-2">${spans}</text>`;
}

function card({ kicker, title, titleSize, titleTop, subtitle, subTop, mono, monoTop, url }) {
  const lineH = titleSize + 12;
  const titleSvg = title
    .map((line, i) => titleLine(line, titleTop + i * lineH, titleSize))
    .join("");

  const subSvg = (subtitle ?? [])
    .map(
      (line, i) =>
        `<text x="${PAD}" y="${subTop + i * 38}" font-family="${FAMILY}" font-weight="400"
          font-size="28" fill="${DIM}">${esc(line)}</text>`,
    )
    .join("");

  const monoSvg = `<rect x="${PAD}" y="${monoTop}" width="${W - PAD * 2}" height="58" fill="${ELEV}" stroke="${FRAME}" stroke-width="2" />
    <text x="${PAD + 22}" y="${monoTop + 29}" font-family="${FAMILY}" font-weight="400"
      font-size="24" fill="${DIM}" dominant-baseline="central"><tspan fill="${ACCENT}">&gt;</tspan> ${esc(mono)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${BG}" />
    <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="${FRAME}" stroke-width="2" />
    <rect x="20" y="20" width="10" height="${H - 40}" fill="${ACCENT}" />
    <text x="${PAD}" y="116" font-family="${FAMILY}" font-weight="800" font-size="44" fill="${ACCENT}">nlqdb</text>
    <text x="${PAD}" y="166" font-family="${FAMILY}" font-weight="400" font-size="22"
      fill="${DIM}" letter-spacing="6">${esc(kicker)}</text>
    ${titleSvg}
    ${subSvg}
    ${monoSvg}
    ${chip(PAD, 524, url)}
  </svg>`;
}

const cards = {
  agents: card({
    kicker: "ANALYTICAL MEMORY FOR AI AGENTS",
    title: [[{ t: "GROUP BY", accent: true }, { t: " your" }], [{ t: "agent's memory." }]],
    titleSize: 82,
    titleTop: 290,
    mono: "SELECT category, COUNT(*) FROM memory GROUP BY category",
    monoTop: 442,
    url: "nlqdb.com/agents",
  }),
};

const vsCompetitors = [
  { slug: "mem0", name: "Mem0" },
  { slug: "zep", name: "Zep" },
  { slug: "letta", name: "Letta" },
  { slug: "langmem", name: "LangMem" },
  { slug: "pinecone", name: "Pinecone" },
  { slug: "chroma", name: "Chroma" },
  { slug: "weaviate", name: "Weaviate" },
  { slug: "qdrant", name: "Qdrant" },
  { slug: "milvus", name: "Milvus" },
  { slug: "cognee", name: "Cognee" },
];
for (const { slug, name } of vsCompetitors) {
  cards[`vs-${slug}`] = card({
    kicker: "COMPARISON",
    title: [[{ t: "nlqdb", accent: true }, { t: ` vs ${name}` }]],
    titleSize: 92,
    titleTop: 290,
    subtitle: ["Both store what your agent remembers.", "Only one lets it run the query."],
    subTop: 360,
    mono: "GROUP BY · JOIN · HAVING over your agent's memory",
    monoTop: 442,
    url: `nlqdb.com/vs/${slug}`,
  });
}

for (const [name, svg] of Object.entries(cards)) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: FAMILY },
  })
    .render()
    .asPng();
  const out = join(outDir, `${name}.png`);
  writeFileSync(out, png);
  console.info(`wrote ${out} (${png.length} bytes)`);
}
