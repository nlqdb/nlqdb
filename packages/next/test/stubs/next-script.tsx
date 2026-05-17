// Test-only stub for next/script. Returns a plain <script> tag so
// the renderToString assertions in script.test.tsx can match.
import { createElement } from "react";

type Props = {
  src?: string;
  strategy?: string;
  type?: string;
};

export default function Script({ src, type }: Props) {
  return createElement("script", { src, type });
}
