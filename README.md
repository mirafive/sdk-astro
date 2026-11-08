# @mirafive/astro

MIRA FIVE for Astro: one integration line puts consent-aware analytics on every page. Astro
bundles the SDK with your own code (no third-party script tag), view transitions count as
pageviews, and your scripts share the same client. Built on
[`@mirafive/web`](https://github.com/mirafive/sdk-web); no other dependencies.

## Install

```sh
npx astro add @mirafive/astro   # or: npm install @mirafive/astro, then add it to integrations
```

```js
import mirafive from "@mirafive/astro";
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [mirafive()], // reads PUBLIC_MIRAFIVE_KEY
});
```

```sh
# .env
PUBLIC_MIRAFIVE_KEY=mira_pk_…
```

## Options

| Option        | Default                                                   | Meaning                                                                              |
| ------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `key`         | `PUBLIC_MIRAFIVE_KEY`                                     | The project's public key. A secret key is refused at build time.                     |
| `host`        | `PUBLIC_MIRAFIVE_HOST`, else `https://events.mirafive.io` | The ingest origin.                                                                   |
| `consent`     | `"auto"`                                                  | Follow the consent banner, or `{ analytics, marketing }` for a custom one.           |
| `autocapture` | all on                                                    | `false`, or `{ pageviews, spa, engagement, outbound, downloads, forms }`.            |
| `debug`       | `false`                                                   | Logs dropped events and failed batches to the console.                               |
| `dev`         | `false`                                                   | Also send from `astro dev`. Off by default, so local work stays out of your numbers. |

## Your own events

```astro
<button id="signup">Sign up</button>
<script>
  import { mira } from "@mirafive/astro/client";
  document.querySelector("#signup")?.addEventListener("click", () => {
    mira.track("signup_started", { plan: "pro" });
  });
</script>
```

`mira` is the page's one client, with the full [`@mirafive/web` API](https://github.com/mirafive/sdk-web#api).
Server endpoints send revenue with [`@mirafive/node`](https://github.com/mirafive/sdk-node).

## For AI coding assistants

Rules for integrating MIRA FIVE correctly. They hold for every MIRA FIVE SDK.

- **Keys:** the public key (`mira_pk_…`) goes in browser and app code. The secret key (`mira_sk_…`)
  goes only into the server's environment (`MIRAFIVE_SECRET_KEY`), never into client code, a
  `NEXT_PUBLIC_`/`VITE_`/`PUBLIC_` variable or a repository. The SDKs refuse the wrong key.
- **Money** is sent only from the server: integer minor units plus an ISO 4217 currency
  (`amount: 1999, currency: "EUR"` is 19.99 EUR), never floats.
- **Count once:** give money an `entryId` from the payment provider (`stripe:in_123`), so the
  Stripe connector and retries do not double it. Give business events a stable id:
  `eventId: await eventIdFor("order:123:paid")`. The same key gives the same id in every SDK.
- **Personal data** never goes into event names or properties. Use your own user id (not an email)
  for `identify`; put email, name and phone in its traits, which MIRA FIVE encrypts at rest.
- **Consent:** keep `consent: "auto"`; it follows the site's consent banner (Usercentrics,
  Cookiebot, consentmanager, CCM19, Borlabs, any TCF 2.2 CMP, Google Consent Mode). Call
  `consent()` only for a custom banner. Do not gate the SDK behind consent yourself: without
  consent it is cookieless and still counts.
- **Never block on analytics:** event methods return nothing, never throw, and batch on their
  own. Do not `await` or `try` them. Call `flush()`/`shutdown()` only at the end of a script or a
  serverless function.
- **Server events and visitors:** pass the browser's `mira.anonymousId` to your server and set it
  as `anonymousId` on server events, so a purchase joins the visit and its source.
