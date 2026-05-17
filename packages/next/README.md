# @nlqdb/next

Next.js 15 App Router helpers around [`@nlqdb/react`](../react) and [`@nlqdb/sdk`](../sdk).

## Install

```sh
bun add @nlqdb/next
# or: npm i @nlqdb/next
```

## Browser surface

```tsx
// app/layout.tsx
import { NlqScript } from "@nlqdb/next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <NlqScript />
      </body>
    </html>
  );
}
```

`<NlqScript />` uses `next/script` with `strategy="afterInteractive"` so the element bundle (default `https://elements.nlqdb.com/v1.js`) is loaded once hydration is done. Override the strategy or src as needed:

```tsx
<NlqScript src="/local/elements.js" strategy="lazyOnload" />
```

```tsx
// app/page.tsx
import { NlqAction, NlqData } from "@nlqdb/next";

export default function Page() {
  return (
    <>
      <NlqData
        goal="today's revenue by drink"
        apiKey={process.env.NEXT_PUBLIC_NLQDB_KEY!}
        template="table"
        refresh="60s"
      />
      <form id="order-form">
        <input name="customer" />
        <NlqAction goal="log this order" form="order-form" apiKey={process.env.NEXT_PUBLIC_NLQDB_KEY!}>
          Submit
        </NlqAction>
      </form>
    </>
  );
}
```

## Server surface (`sk_live_*` kept off the wire)

```ts
// app/api/nlqdb/ask/route.ts
export { createAskRoute as POST } from "@nlqdb/next/server";
// or, with a per-tenant key:
// import { createAskRoute } from "@nlqdb/next/server";
// export const POST = createAskRoute({ apiKey: lookupTenantKey() });
```

The route forwards `Idempotency-Key` if the caller provides one and lets `@nlqdb/sdk` auto-mint otherwise ([`SK-SDK-006`](../../docs/features/sdk/FEATURE.md)). Errors are mapped to the canonical `{ error: { status, message, … } }` envelope so browser callers get the same shape as `app.nlqdb.com/v1/ask`.

Direct use (Server Action, Server Component):

```tsx
// app/dashboard/page.tsx
import { nlqdbServer } from "@nlqdb/next/server";

export default async function Dashboard() {
  const client = nlqdbServer();
  const { rows } = await client.runSql({ db: "orders", sql: "select count(*) from orders" });
  return <p>{rows[0].count} orders</p>;
}
```

`nlqdbServer()` reads `NLQDB_API_KEY` from the environment. `/server` is gated by `import "server-only"` — importing it from a Client Component fails the build.

## RSC + custom-element hydration

Custom elements render fine inside a Server Component, but the underlying class isn't available until the element bundle runs on the client. `<NlqScript />` is the loader; the element renders an idle state until the bundle upgrades it.
