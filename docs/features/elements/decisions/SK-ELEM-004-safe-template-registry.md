# SK-ELEM-004 — Safe template registry (`table`, `list`, `kv` in v0.1) — LLM never returns raw HTML

- **Decision:** Rendered output goes through a small fixed template registry. v0.1 ships three templates: `table`, `list`, `kv`. v1+ adds `card-grid` and `chart`. The API returns `{ answer, data, ...trace }`; the element renders client-side via the chosen template. The LLM never returns raw HTML to the browser — XSS is structurally impossible because the templates control every element creation.
- **Core value:** Bullet-proof, Simple, Creative
- **Why:** A "render whatever JSON the LLM gives you" approach is one prompt-injection away from script execution. Constraining output to a registry makes XSS unreachable: the templates accept typed JSON and produce DOM, and there's no path for an attacker to inject `<script>` because we never `innerHTML` a value we didn't validate. The template registry also gives us a finite, testable visual surface — every embedder gets predictable HTML structure.
- **Consequence in code:** `templates.ts` is the only module that creates DOM nodes from response data. New templates are added there with explicit type contracts. Reviewers reject any `el.innerHTML = response.data` style code path. The DESIGN §3.5 promise ("`render: "html"`" with server-side HTML) is **deferred**: today the API returns rows + the element renders client-side from templates. Server-side `render: "html"` is in `README.md`'s "What's NOT in v0.1" list.
- **Alternatives rejected:**
  - LLM-rendered HTML returned in the response — XSS in one line; we'd be one prompt-injection from a global compromise of every embed.
  - Render-by-template-string (Mustache, Handlebars) — adds a parser to the bundle, contradicts `GLOBAL-013`'s 6 KB ceiling.
