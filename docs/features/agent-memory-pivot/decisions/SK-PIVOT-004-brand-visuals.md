# SK-PIVOT-004 — Visualizations stay on-brand: code/CSS motion and type, never stock or produced video

- **Decision:** Every pivot "visualization" — the capability matrix, the
  demo, the OG images — is rendered in the existing brand system (acid-lime
  `#c6f432` on near-black `#0b0f0a`, JetBrains Mono, hard shadows, live
  `<nlq-data>` / CSS motion). The framing doc's "one 90-second demo video"
  becomes a **live, interactive in-page demo + a technical blog post**, not a
  produced video with footage.
- **Core value:** Creative, Honest latency
- **Why:** Manifesto tenet 08 forbids stock photos and decorative imagery;
  the site is deliberately illustration-free and that *is* the brand. A live
  demo (a real `GROUP BY` over an `agent_memory` table in the page) is
  on-brand and a stronger proof than a produced video.
- **Consequence in code:** OG images authored in the brand palette as
  type-on-dark (no raster screenshots). The `/agents` demo is `<nlq-data>` or
  the carousel, not `<img>`/`<video>`. The blog post (WS-09) is the long-form
  artifact.
- **Alternatives rejected:** Commission a video — off-brand, stale on first
  change. · Screenshot the matrix as a PNG — raster drift + tenet-08.
