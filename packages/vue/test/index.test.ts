import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { NlqData } from "../src/index.ts";

describe("<NlqData> (vue)", () => {
  it("renders <nlq-data> with the camelCase → kebab-case attribute mapping", () => {
    const wrapper = mount(NlqData, {
      props: { goal: "top users", apiKey: "pk_live_abc", template: "list", refresh: "10s" },
    });
    const el = wrapper.element as HTMLElement;
    expect(el.tagName.toLowerCase()).toBe("nlq-data");
    expect(el.getAttribute("goal")).toBe("top users");
    expect(el.getAttribute("api-key")).toBe("pk_live_abc");
    expect(el.getAttribute("template")).toBe("list");
    expect(el.getAttribute("refresh")).toBe("10s");
  });

  it("emits 'load' when nlq-data:load fires", async () => {
    const wrapper = mount(NlqData, { props: { goal: "x" } });
    wrapper.element.dispatchEvent(
      new CustomEvent("nlq-data:load", { detail: { rows: 3, cached: true } }),
    );
    expect(wrapper.emitted("load")?.[0]).toEqual([{ rows: 3, cached: true }]);
  });

  it("emits 'error' when nlq-data:error fires", async () => {
    const wrapper = mount(NlqData, { props: { goal: "x" } });
    wrapper.element.dispatchEvent(
      new CustomEvent("nlq-data:error", { detail: { kind: "auth", status: 401 } }),
    );
    expect(wrapper.emitted("error")?.[0]).toEqual([{ kind: "auth", status: 401 }]);
  });
});
