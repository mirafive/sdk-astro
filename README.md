# @mirafive/sdk-astro

The Astro integration of MIRA FIVE: privacy-first analytics bundled into your site's own
JavaScript (no third-party script), hosted in the EU.

## Size

| Import | min + gzip |
|---|---|
| Injected script, default config (core, pageviews, `astro()`, a key) | 3.00 kB |
| The same `createMira({ key, plugins: [pageviews()] })` without this package | 2.82 kB |
| Injected script, `mode: "full"` with every feature | 4.87 kB |
| `@mirafive/sdk-astro/client` `mirafive()` in your own scripts | 0.11 kB |
| `@mirafive/sdk-astro` (the integration; runs at build time, never shipped) | 1.11 kB |

What you do not list in `features` is not shipped: the injected script imports only the
`@mirafive/sdk-browser` subpaths it needs, and your bundler tree-shakes the rest.

## Install

```sh
npm install @mirafive/sdk-astro @mirafive/sdk-browser
# or: bun add / pnpm add / yarn add
```

Astro 7, Node ≥ 22.12. `@mirafive/sdk-browser` 1.0 is a required peer.

## Quickstart

```sh
# .env
PUBLIC_MIRAFIVE_KEY=mf_…   # the source's website key
```

```js
// astro.config.mjs (or: npx astro add @mirafive/sdk-astro)
import mirafive from "@mirafive/sdk-astro"
import { defineConfig } from "astro/config"

export default defineConfig({
  integrations: [mirafive()]
})
```

That is the whole setup: every page now sends a pageview on load and on every
`<ClientRouter />` navigation. Custom events from any script or island:

```ts
import { mirafive } from "@mirafive/sdk-astro/client"

mirafive("track", "signup", { plan: "pro" })
```

For revenue, add `payment_id` (1–255 characters) to the properties next to `revenue` and `currency`: the payment provider's id of the payment. For Stripe pass the Checkout Session id on the success page or the PaymentIntent id from a webhook, for example `mirafive("track", "order completed", { revenue: 49, currency: "EUR", payment_id: sessionId })`. MIRA FIVE merges the event with the payment it imports from your connected Stripe account, so the sale counts once.

Verify it: `astro build && astro preview` does not send from `localhost`; deploy (or pass
`trackLocalhost: true`) and look for `POST https://collect.mirafive.io/v1/batch/mf_…`
answering `202` in the browser's network tab, then for the pageview in the source's live
view in MIRA FIVE. `view-source:` shows no `<script src>` from a third-party origin.

## Consent & privacy

- **Default mode: `consentless`.** No cookies, no storage, no ids; the page (URL with
  only campaign and click-id parameters, title, referrer) and your event properties. It
  needs no consent banner.
- **`mode: "full"`** adds `identity()`: an anonymous id, a session id, your user id, and
  locale, time zone and screen size; it unlocks `search`. Before a consent answer nothing is sent or stored. Wire your banner to it:

  ```ts
  import { mirafive } from "@mirafive/sdk-astro/client"

  acceptButton.addEventListener("click", () => mirafive("consent", true)) // statistics
  declineButton.addEventListener("click", () => mirafive("consent", false)) // forgets ids
  mirafive("consent", { statistics: true }) // same as true
  ```

  Statistics is the only consent purpose. The old `experiments` and `targeting` keys are accepted and ignored.

  Inline scripts and CMP callbacks can call `window.mirafive("consent", true)` instead,
  with the hosted tracker's stub in front if they may run first:
  `window.mirafive=window.mirafive||function(){(mirafive.q=mirafive.q||[]).push(arguments)}`.
  Calls made before the client starts are queued and run before the landing pageview,
  so a stored answer replayed on load counts the landing page. A CMP that knows the
  answer before any script runs may set `window.__mirafive_consent` instead.
- Do Not Track, Global Privacy Control, `window.__mirafive_ignore = true` and
  prerendering send nothing; `localhost`, `127.*`, `[::1]`, `*.local` and `file:` send
  nothing unless `trackLocalhost: true`.
- Full mode stores `mirafive:{namespace}:aid`, `:sid` and `:uid` in `localStorage`, never
  cookies (see `@mirafive/sdk-browser`).

## API reference

### `@mirafive/sdk-astro`

`mirafive(options?): AstroIntegration`, as a named and the default export (so `astro add`
works).

| Option | Default | |
|---|---|---|
| `key` | `PUBLIC_MIRAFIVE_KEY` | the source's website key (`mf_…`); without one, a build warning and nothing injected |
| `host` | `https://collect.mirafive.io` | must have a scheme |
| `mode` | `"consentless"` | `"full"` bundles `identity()` |
| `features` | `[]` | any of `"autocapture"`, `"search"`; `search` needs `mode: "full"` |
| `dev` | `false` | also run under `astro dev`, sending from localhost there |
| `trackLocalhost` | `false` (`true` under `astro dev` with `dev: true`) | |

It throws while the config loads for a `secretKey` option, an unknown mode or feature, a
host without a scheme, and `search` in consentless mode, and fails the
build when the key equals `MIRAFIVE_SECRET_KEY`. Types: `MirafiveOptions`, `Feature`.

The injected script is, for `mirafive({ mode: "full", features: ["autocapture"] })`:

```js
import { createMira } from "@mirafive/sdk-browser"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { identity } from "@mirafive/sdk-browser/identity"
import { autocapture } from "@mirafive/sdk-browser/autocapture"
import { astro } from "@mirafive/sdk-astro/client"

createMira({ "key":"mf_…","mode":"full", plugins: [pageviews(), identity(), autocapture(), astro()] })
```

### `@mirafive/sdk-astro/client`

| Export | |
|---|---|
| `mirafive(verb, ...args)` | the hosted tracker's verbs: `track`, `pageview`, `flush`, `consent`, `identify`, `reset`, `anonymousId`, `search`, and every other client method by name, typed per verb. `mirafive("anonymousId", (id) => …)` answers to the callback, also when queued. Queued on `window.mirafive` until the client runs (then `undefined` is returned). Unknown verbs warn in development. `undefined` on the server |
| `astro()` | the `@mirafive/sdk-browser` plugin the injected script ends with: installs `window.mirafive`, runs its queue, and holds a `<ClientRouter />` navigation's pageview until `astro:page-load` |
| `MirafiveCommand` | the type of `mirafive` |

## Framework / runtime notes

- **View transitions.** `pageviews()` follows `<ClientRouter />` navigations through the
  Navigation API (or the history patch). On a link click the router pushes the URL after
  swapping the page, so the title is right; on back and forward it changes the URL
  first and fetches the page afterwards, so the title would still be the old page's.
  `astro()` therefore holds a pageview that arrives between `astro:before-preparation`
  and `astro:page-load` and sends it at `astro:page-load` with the new title and the
  right referrer. Without `<ClientRouter />` those events never fire and nothing
  changes. The injected script is a module script, so the router runs it once, not per
  navigation.
- **pnpm and other strict installs.** The injected module imports `@mirafive/sdk-browser`
  by the file path resolved from this package, so it works when the peer is linked only
  beside `@mirafive/sdk-astro` and not in the project root.
- **CSP:** `connect-src https://collect.mirafive.io` (or your `host`). No `script-src`
  change: the code is part of your own bundle.
- **`astro dev`** sends nothing unless `dev: true`; `window.mirafive` calls then queue
  harmlessly.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Nothing arrives | `astro dev` without `dev: true`; `astro preview` on localhost without `trackLocalhost: true`; the build warned "no website key" (set `PUBLIC_MIRAFIVE_KEY`); Do Not Track, GPC or `__mirafive_ignore`; in mode `"full"`, no `consent(true)` yet. |
| `403 secret_key_in_path` / `website_key_as_bearer` | The key kinds are swapped: `PUBLIC_MIRAFIVE_KEY` is the website key, `MIRAFIVE_SECRET_KEY` the secret key of a server source. |
| `403 origin_not_allowed` | Add the site's origin to the source's allowed origins in MIRA FIVE. |
| Back/forward pageviews carry the old title | The page does not run the injected script (a custom `injectScript` setup without `astro()`). |
## For AI agents

Copy-paste setup prompt:

```text
Add MIRA FIVE analytics to this Astro site with @mirafive/sdk-astro.
1. Install @mirafive/sdk-astro and @mirafive/sdk-browser with the project's package
   manager.
2. Put the source's website key in .env as PUBLIC_MIRAFIVE_KEY=mf_… (and in the deploy
   environment).
3. Run `npx astro add @mirafive/sdk-astro`, or in astro.config.*: import mirafive from
   "@mirafive/sdk-astro" and add mirafive() to integrations. Do not add a <script> tag
   for MIRA FIVE anywhere.
4. Keep the default consentless mode: it needs no banner. Only if the site already has a
   consent banner and wants ids: mirafive({ mode: "full" }) and, in the banner's accept
   and decline handlers, import { mirafive } from "@mirafive/sdk-astro/client" and call
   mirafive("consent", true) / mirafive("consent", false).
5. Verify: run the build, check that dist HTML has no MIRA FIVE <script src> from another
   origin, deploy (or set trackLocalhost: true and preview), and confirm
   POST https://collect.mirafive.io/v1/batch/<key> answers 202 in the network tab. Report
   what you changed.
Do not add other analytics libraries, cookies or consent banners.
```

Facts for agents:

- Imports: `import mirafive from "@mirafive/sdk-astro"` (the integration, default or
  named export, in `astro.config` only; `npx astro add @mirafive/sdk-astro` wires it);
  `import { mirafive } from "@mirafive/sdk-astro/client"` (the command function, in
  browser scripts).
- Exact config: `mirafive({ key?, host?, mode?: "consentless" | "full", features?:
  ("autocapture" | "search")[], dev?, trackLocalhost? })`.
  `search` needs `mode: "full"`.
- Env var: `PUBLIC_MIRAFIVE_KEY` (website key, public, read at build time).
- Never ship `MIRAFIVE_SECRET_KEY` to a browser bundle: the build fails when the website
  key equals it, a `secretKey` option throws, and a secret key in a URL is refused and
  marked exposed by the server.
- Consentless (default) needs no banner and sends from the first page. `mode: "full"`
  sends nothing until `mirafive("consent", true)` (or a scoped answer); put it behind the
  site's banner. The same verbs work on `window.mirafive` in inline scripts.
- Nothing throws for transport reasons: browser failures are dropped with a
  `[mirafive] …` warning on local hosts.
- Verify an install: the built page has a `<script type="module" src="/_astro/…">` whose
  code contains the key and no `cdn.mirafive.io` reference; on the deployed site the
  network tab shows `POST …/v1/batch/{key}` answering `202`, and the event appears in the
  source's live view.
- Wire contract: [mirafive/protocol](https://github.com/mirafive/protocol).

## License

[MIT](LICENSE) © 2026 Cloo GmbH
