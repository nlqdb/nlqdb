import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import NlqAction from "../src/NlqAction.astro";
import NlqData from "../src/NlqData.astro";

// WS03-T4: per SK-FW-001 each adapter is framework-idiomatic, so Astro's
// canonical prop is kebab-case `api-key`. We also accept the React/Vue
// `apiKey` spelling so a snippet copied between wrappers still binds the key.
describe("<NlqData> (astro)", () => {
  it("binds the kebab-case `api-key` prop", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(NlqData, {
      props: { goal: "top users", "api-key": "pk_live_kebab" },
    });
    expect(html).toContain('api-key="pk_live_kebab"');
  });

  it("also accepts the camelCase `apiKey` alias", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(NlqData, {
      props: { goal: "top users", apiKey: "pk_live_camel" },
    });
    expect(html).toContain('api-key="pk_live_camel"');
  });
});

describe("<NlqAction> (astro)", () => {
  it("binds the kebab-case `api-key` prop", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(NlqAction, {
      props: { goal: "log order", "api-key": "pk_live_kebab" },
    });
    expect(html).toContain('api-key="pk_live_kebab"');
  });

  it("also accepts the camelCase `apiKey` alias", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(NlqAction, {
      props: { goal: "log order", apiKey: "pk_live_camel" },
    });
    expect(html).toContain('api-key="pk_live_camel"');
  });
});
