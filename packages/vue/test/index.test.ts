import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { NlqAction, NlqData } from "../src/index.ts";

describe("<NlqData> (vue)", () => {
  it("renders <nlq-data> with the camelCase → kebab-case attribute mapping", () => {
    const wrapper = mount(NlqData, {
      props: {
        goal: "top users",
        apiKey: "pk_live_abc",
        template: "list",
        refresh: "10s",
        model: "fast",
      },
    });
    const el = wrapper.element as HTMLElement;
    expect(el.tagName.toLowerCase()).toBe("nlq-data");
    expect(el.getAttribute("goal")).toBe("top users");
    expect(el.getAttribute("api-key")).toBe("pk_live_abc");
    expect(el.getAttribute("template")).toBe("list");
    expect(el.getAttribute("refresh")).toBe("10s");
    expect(el.getAttribute("model")).toBe("fast");
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

describe("<NlqAction> (vue)", () => {
  it("renders <nlq-action> with kebab-cased attributes", () => {
    const wrapper = mount(NlqAction, {
      props: { goal: "log order", apiKey: "pk_live_a", form: "f", label: "Go" },
    });
    const el = wrapper.element as HTMLElement;
    expect(el.tagName.toLowerCase()).toBe("nlq-action");
    expect(el.getAttribute("api-key")).toBe("pk_live_a");
    expect(el.getAttribute("form")).toBe("f");
    expect(el.getAttribute("label")).toBe("Go");
  });

  it("emits 'success' and 'confirmRequired' on the matching CustomEvents", () => {
    const wrapper = mount(NlqAction, { props: { goal: "x" } });
    wrapper.element.dispatchEvent(
      new CustomEvent("nlq-action:confirm-required", {
        detail: { diff: { kind: "preview", rowsAffected: 2 } },
      }),
    );
    wrapper.element.dispatchEvent(
      new CustomEvent("nlq-action:success", {
        detail: { rowCount: 2, diff: { kind: "preview", rowsAffected: 2 } },
      }),
    );
    expect(wrapper.emitted("confirmRequired")?.length).toBe(1);
    expect(wrapper.emitted("success")?.length).toBe(1);
  });
});
