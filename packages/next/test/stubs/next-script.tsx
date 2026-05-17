// Vitest stub — renders a plain <script> tag so renderToString assertions match.
import { createElement } from "react";

type Props = {
  src?: string;
  strategy?: string;
  type?: string;
};

export default function Script({ src, type }: Props) {
  return createElement("script", { src, type });
}
