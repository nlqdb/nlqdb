# @nlqdb/react

React 19 wrapper for [`<nlq-data>`](../elements). Typed component + matching `JSX.IntrinsicElements` augmentation + a CDN script-injection helper.

## Install

```sh
bun add @nlqdb/react @nlqdb/elements
# or: npm i @nlqdb/react @nlqdb/elements
```

`@nlqdb/elements` registers the `<nlq-data>` custom element when this wrapper mounts. Both packages are listed as `peerDependencies`.

## Usage

```tsx
import { NlqData, NlqScript } from "@nlqdb/react";

export default function Page() {
  return (
    <>
      <NlqScript />
      <NlqData
        goal="today's revenue by drink"
        apiKey={process.env.NEXT_PUBLIC_NLQDB_KEY!}
        template="table"
        refresh="60s"
        onLoad={({ rows, cached }) => console.info("load", rows, cached)}
        onError={(err) => console.error(err)}
      />
    </>
  );
}
```

## Why a wrapper if React 19 supports custom elements natively?

React 19 forwards primitive props as attributes and lets you render `<nlq-data>` directly — but it does **not** wire `on*` props to non-standard DOM events ([release note](https://react.dev/blog/2024/12/05/react-19#support-for-custom-elements)). This wrapper attaches `nlq-data:load` / `nlq-data:error` listeners imperatively, so the `onLoad` / `onError` props "just work".

It also augments `JSX.IntrinsicElements["nlq-data"]` so direct usage (`<nlq-data goal="…">`) is type-checked.

## SSR

The wrapper is SSR-safe — the underlying element module guards on `typeof customElements` and only defines on the client. For Next.js App Router, drop `<NlqScript />` into your root layout; the element bundle is loaded with `strategy="afterInteractive"` via the [`@nlqdb/next`](../next) wrapper.

## Server-side data

Browser embeds use `pk_live_*` (read-only, origin-pinned). For `sk_live_*`-keyed server fetches use [`@nlqdb/sdk`](../sdk) directly inside a Server Component or Route Handler.
