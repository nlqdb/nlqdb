import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NlqScript } from "../src/script.tsx";

describe("<NlqScript>", () => {
  it("renders the elements bundle module script with the public CDN by default", () => {
    const { container } = render(<NlqScript />);
    const script = container.querySelector("script");
    expect(script).not.toBeNull();
    expect(script?.getAttribute("src")).toBe("https://elements.nlqdb.com/v1.js");
    expect(script?.getAttribute("type")).toBe("module");
  });

  it("honours an explicit src override (self-host, preview deploys)", () => {
    const { container } = render(<NlqScript src="/local/v1.js" />);
    expect(container.querySelector("script")?.getAttribute("src")).toBe("/local/v1.js");
  });
});
