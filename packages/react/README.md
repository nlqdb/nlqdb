# @nlqdb/react

React 19 wrappers for [`<nlq-data>`](../elements) (reads) and [`<nlq-action>`](../elements) (writes with preview→Apply). Typed components, matching `JSX.IntrinsicElements` augmentations, CDN script-injection helper.

## Install

```sh
bun add @nlqdb/react @nlqdb/elements
# or: npm i @nlqdb/react @nlqdb/elements
```

`@nlqdb/elements` registers `<nlq-data>` + `<nlq-action>` when these wrappers mount. Both packages are listed as `peerDependencies`.

## Read — `<NlqData>`

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

## Write — `<NlqAction>`

`<NlqAction>` is the write counterpart. First click previews the change; the surface renders the diff; second click commits.

```tsx
import { NlqAction } from "@nlqdb/react";

export function NewOrderButton() {
  return (
    <form id="order-form">
      <input name="customer" />
      <input name="drink" />
      <NlqAction
        goal="log this order"
        form="order-form"
        apiKey={process.env.NEXT_PUBLIC_NLQDB_KEY!}
        onConfirmRequired={({ diff }) => console.info("preview", diff)}
        onSuccess={({ rowCount }) => console.info("committed", rowCount)}
        onSuccessAction="reload"
      >
        Submit order
      </NlqAction>
    </form>
  );
}
```

## Why a wrapper if React 19 supports custom elements natively?

React 19 forwards primitive props as attributes and lets you render `<nlq-data>` / `<nlq-action>` directly — but it does **not** wire `on*` props to non-standard DOM events ([release note](https://react.dev/blog/2024/12/05/react-19#support-for-custom-elements)). These wrappers attach `nlq-data:load` / `nlq-action:success` etc. listeners imperatively, so the `onLoad` / `onSuccess` / `onConfirmRequired` props "just work".

The wrappers also augment `JSX.IntrinsicElements` for both tags so direct usage is type-checked.

## SSR

Both wrappers are SSR-safe — the underlying element module guards on `typeof customElements` and only defines on the client. For Next.js App Router, drop `<NlqScript />` into your root layout; the element bundle is loaded with `strategy="afterInteractive"` via the [`@nlqdb/next`](../next) wrapper.

## Server-side data

Browser embeds use `pk_live_*` (read-only, origin-pinned). For `sk_live_*`-keyed server fetches use [`@nlqdb/sdk`](../sdk) directly inside a Server Component or Route Handler.
