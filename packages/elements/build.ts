import { build } from "esbuild";

// CDN bundle. Single ESM, minified, no source map. Browser target
// (es2022) matches what every modern evergreen browser supports
// without polyfills. The bundle registers `<nlq-data>` on import,
// so a bare `<script src=".../v1.js" type="module">` tag is enough
// to opt in — no top-level wiring needed by the consumer.
//
// Distribution (Slice 9 manual; Slice 10+ may automate): upload
// `dist/v1.js` to R2 under the `elements.nlqdb.com` bucket.
// Bundle-size budget per DESIGN §3.5: < 6 KB gzipped.

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  outfile: "dist/v1.js",
  legalComments: "none",
});

console.info("[elements] built dist/v1.js");
