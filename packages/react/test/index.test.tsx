import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NlqData, NlqScript } from "../src/index.ts";

describe("<NlqData>", () => {
  it("renders <nlq-data> with the camelCase → kebab-case attribute mapping", () => {
    const { container } = render(
      <NlqData goal="top users" apiKey="pk_live_abc" template="table" refresh="30s" />,
    );
    const el = container.querySelector("nlq-data");
    expect(el).not.toBeNull();
    expect(el!.getAttribute("goal")).toBe("top users");
    expect(el!.getAttribute("api-key")).toBe("pk_live_abc");
    expect(el!.getAttribute("template")).toBe("table");
    expect(el!.getAttribute("refresh")).toBe("30s");
  });

  it("invokes onLoad on nlq-data:load CustomEvent", () => {
    const onLoad = vi.fn();
    const { container } = render(<NlqData goal="x" onLoad={onLoad} />);
    container
      .querySelector("nlq-data")!
      .dispatchEvent(new CustomEvent("nlq-data:load", { detail: { rows: 4, cached: false } }));
    expect(onLoad).toHaveBeenCalledWith({ rows: 4, cached: false });
  });

  it("invokes onError on nlq-data:error CustomEvent and tears down listeners", () => {
    const onError = vi.fn();
    const { container, unmount } = render(<NlqData goal="x" onError={onError} />);
    const el = container.querySelector("nlq-data")!;
    el.dispatchEvent(new CustomEvent("nlq-data:error", { detail: { kind: "auth", status: 401 } }));
    expect(onError).toHaveBeenCalledTimes(1);
    unmount();
    // After unmount the listener must be gone — dispatching again
    // must not invoke the handler.
    el.dispatchEvent(new CustomEvent("nlq-data:error", { detail: { kind: "auth", status: 401 } }));
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("<NlqScript>", () => {
  it("renders a module script tag pointing at the public CDN by default", () => {
    const { container } = render(<NlqScript />);
    const script = container.querySelector("script");
    expect(script).not.toBeNull();
    expect(script!.getAttribute("src")).toBe("https://elements.nlqdb.com/v1.js");
    expect(script!.getAttribute("type")).toBe("module");
  });

  it("honours an explicit src override (self-host, preview deploys)", () => {
    const { container } = render(<NlqScript src="/local/v1.js" />);
    expect(container.querySelector("script")!.getAttribute("src")).toBe("/local/v1.js");
  });
});
