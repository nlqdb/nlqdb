# @nlqdb/solid

SolidJS wrapper for [`<nlq-data>`](../elements). Uses Solid's native `attr:` and `on:` namespaces.

## Install

```sh
bun add @nlqdb/solid @nlqdb/elements
```

## Usage

```tsx
import { NlqData } from "@nlqdb/solid";

export default function App() {
  return (
    <NlqData
      goal="today's revenue by drink"
      apiKey={import.meta.env.VITE_NLQDB_KEY}
      template="table"
      refresh="60s"
      onLoad={({ rows, cached }) => console.info(rows, cached)}
    />
  );
}
```

The custom element is lazy-loaded on first mount via `import("@nlqdb/elements")`. Solid's reactivity handles all attribute updates natively — no wrapper overhead.
