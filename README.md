# @mirafive/sdk-astro

The Astro integration of MIRA FIVE: privacy-first analytics bundled into your site's own
JavaScript (no third-party script), and feature flags rendered on the server, hosted in
the EU.

## Size

| Import | min + gzip |
|---|---|
| Injected script, default config (core, pageviews, `astro()`, a key) | 3.05 kB |
| The same `createMira({ key, plugins: [pageviews()] })` without this package | 2.82 kB |
| Injected script, `mode: "full"` with every feature | 7.58 kB |
| `@mirafive/sdk-astro/client` `mirafive()` in your own scripts | 0.16 kB |
| `@mirafive/sdk-astro/server` (plus `@mirafive/sdk-server`, server only) | 0.29 kB |
| `@mirafive/sdk-astro` (the integration; runs at build time, never shipped) | 1.16 kB |

What you do not list in `features` is not shipped: the injected script imports only the
`@mirafive/sdk-browser` subpaths it needs, and your bundler tree-shakes the rest.

## Install

```sh
npm install @mirafive/sdk-astro @mirafive/sdk-browser
# flags on the server as well:
npm install @mirafive/sdk-server
# or: bun add / pnpm add / yarn add
```

Astro 7, Node ≥ 22.12. `@mirafive/sdk-browser` 1.0 is a required peer,
`@mirafive/sdk-server` 1.0 an optional one (only for `@mirafive/sdk-astro/server`).

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

Feature flags on a server-rendered page:

```astro
---
// src/pages/checkout.astro
import { miraFlagsFor, MiraFlagsScript } from "@mirafive/sdk-astro/server"

export const prerender = false

const flags = await miraFlagsFor(Astro, { userId: Astro.locals.user?.id })
Astro.response.headers.set("Cache-Control", "private, no-store")
---

<html>
  <head><MiraFlagsScript flags={flags} /></head>
  <body>{flags.enabled("new-checkout") ? <NewCheckout /> : <Checkout />}</body>
</html>
```

with `MIRAFIVE_SECRET_KEY` in the server's environment and `features: ["flags"]` in the
integration when the browser reads flags too.

Verify it: `astro build && astro preview` does not send from `localhost`; deploy (or pass
`trackLocalhost: true`) and look for `POST https://events.mirafive.io/v1/batch/mf_…`
answering `202` in the browser's network tab, then for the pageview in the source's live
view in MIRA FIVE. `view-source:` shows no `<script src>` from a third-party origin.

## Consent & privacy

- **Default mode: `consentless`.** No cookies, no storage, no ids; the page (URL with
  only campaign and click-id parameters, title, referrer) and your event properties. It
  needs no consent banner.
- **`mode: "full"`** adds `identity()`: an anonymous id, a session id, your user id, and
  locale, time zone and screen size; it unlocks `search`, `experiments` and segment
  targeting. Before a consent answer nothing is sent or stored. Wire your banner to it:

  ```ts
  import { mirafive } from "@mirafive/sdk-astro/client"

  acceptButton.addEventListener("click", () => mirafive("consent", true)) // statistics
  declineButton.addEventListener("click", () => mirafive("consent", false)) // forgets ids
  mirafive("consent", { statistics: true, experiments: true, targeting: false }) // by scope
  ```

  Inline scripts and CMP callbacks can call `window.mirafive("consent", true)` instead,
  with the hosted tracker's stub in front if they may run first:
  `window.mirafive=window.mirafive||function(){(mirafive.q=mirafive.q||[]).push(arguments)}`.
  Calls made before the client starts are queued and run before the landing pageview,
  so a stored answer replayed on load counts the landing page. A CMP that knows the
  answer before any script runs may set `window.__mirafive_consent` instead.
- Do Not Track, Global Privacy Control, `window.__mirafive_ignore = true` and
  prerendering send nothing; `localhost`, `127.*`, `[::1]`, `*.local` and `file:` send
  nothing unless `trackLocalhost: true`.
- Server-side: `miraFlagsFor()` sets `optedOut` when the request carries `Sec-GPC: 1` or
  `DNT: 1` (no ids, no segment lookup, no exposure).
- Full mode stores `mirafive:{namespace}:aid`, `:sid` and `:uid` in `localStorage`, never
  cookies (see `@mirafive/sdk-browser`).

## API reference

### `@mirafive/sdk-astro`

`mirafive(options?): AstroIntegration`, as a named and the default export (so `astro add`
works).

| Option | Default | |
|---|---|---|
| `key` | `PUBLIC_MIRAFIVE_KEY` | the source's website key (`mf_…`); without one, a build warning and nothing injected |
| `host` | `https://events.mirafive.io` | must have a scheme |
| `mode` | `"consentless"` | `"full"` bundles `identity()` |
| `features` | `[]` | any of `"autocapture"`, `"search"`, `"flags"`, `"experiments"`; `experiments` brings `flags`; `search` and `experiments` need `mode: "full"` |
| `dev` | `false` | also run under `astro dev`, sending from localhost there |
| `trackLocalhost` | `false` (`true` under `astro dev` with `dev: true`) | |

It throws while the config loads for a `secretKey` option, an unknown mode or feature, a
host without a scheme, and `search`/`experiments` in consentless mode, and fails the
build when the key equals `MIRAFIVE_SECRET_KEY`. Types: `MirafiveOptions`, `Feature`.

The injected script is, for `mirafive({ mode: "full", features: ["flags"] })`:

```js
import { createMira } from "@mirafive/sdk-browser"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { identity } from "@mirafive/sdk-browser/identity"
import { flags } from "@mirafive/sdk-browser/flags"
import { astro } from "@mirafive/sdk-astro/client"

createMira({ "key":"mf_…","mode":"full", plugins: [pageviews(), identity(), flags(), astro()] })
```

### `@mirafive/sdk-astro/client`

| Export | |
|---|---|
| `mirafive(verb, ...args)` | the hosted tracker's verbs: `track`, `pageview`, `flush`, `consent`, `identify`, `reset`, `anonymousId`, `search`, `flag`, `config`, `flags` (listener), `flagProperties`, and every other client method by name (`onFlags`, `setFlagProperties`), typed per verb. `mirafive("anonymousId", (id) => …)` answers to the callback, also when queued. Queued on `window.mirafive` until the client runs (then `undefined` is returned), except `flag` and `config`: they answer their fallback until then and are never queued, since a replayed read would count an exposure for a value the page never showed (read flags in the `flags` listener). Unknown verbs warn in development. `undefined` on the server |
| `astro()` | the `@mirafive/sdk-browser` plugin the injected script ends with: installs `window.mirafive`, runs its queue, and holds a `<ClientRouter />` navigation's pageview until `astro:page-load` |
| `MirafiveCommand` | the type of `mirafive` |

### `@mirafive/sdk-astro/server`

| Export | |
|---|---|
| `miraFlagsFor(context, unit?, { waitUntil? }?): Promise<UserFlags>` | `context` is `Astro` or an `APIContext`; `unit` is `@mirafive/sdk-server`'s `{ userId?, anonymousId?, properties?, consent?, optedOut? }`; `waitUntil` is this request's, for background refreshes and exposures on Workers. One `MiraFlags` per server process, from `MIRAFIVE_SECRET_KEY` and `MIRAFIVE_HOST` read with `astro:env/server`'s `getSecret`, with one `Mira` on the same key that sends the `$exposure` of experiments counted on the server (`c: "s"`, also when a bootstrap hands one to the page); a request's `waitUntil` flushes it. `Sec-GPC: 1` / `DNT: 1` set `optedOut`. |
| `MiraFlagsScript` | component, `flags` prop: renders `flags.bootstrap()`, the `<script type="application/json" id="mirafive-flags">` block the browser `flags()` plugin reads at start. |
| `MiraFlagsScriptProps` | its props type |

`UserFlags`: `enabled(key, fallback?)`, `variant(key, fallback?)`, `config(key, fallback)`,
`evaluate(key)`, `bootstrap()` (see `@mirafive/sdk-server`).

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
- **Pages with a bootstrap block** are per visitor: render them on demand
  (`prerender = false`, an adapter) and send `Cache-Control: private, no-store`
  (`bootstrapHeaders` from `@mirafive/sdk-server/flags`) from the page's frontmatter;
  headers set inside a component may arrive after the response has started. The browser
  reads the block once at start; later `<ClientRouter />` pages refetch flags instead.
- **pnpm and other strict installs.** The injected module imports `@mirafive/sdk-browser`
  by the file path resolved from this package, so it works when the peer is linked only
  beside `@mirafive/sdk-astro` and not in the project root.
- **Secrets.** The server entry reads `getSecret("MIRAFIVE_SECRET_KEY")`, so it works
  with every adapter's runtime env and with `.env` under `astro dev`. It needs this
  integration in `astro.config`, which also keeps the package inside Vite's SSR bundle
  (`ssr.noExternal`) so that the `.astro` component and `astro:env` resolve.
- **Cloudflare.** `MiraFlags` refreshes on read and sends server-counted exposures in the
  background; hand it the request's `waitUntil` so the isolate keeps them alive. With
  `@astrojs/cloudflare` the execution context is `Astro.locals.cfContext` (it replaced
  `Astro.locals.runtime.ctx`); call it through an arrow, since `waitUntil` needs its
  `this`:

  ```astro
  ---
  const { cfContext } = Astro.locals
  const flags = await miraFlagsFor(Astro, { userId }, { waitUntil: (promise) => cfContext.waitUntil(promise) })
  ---
  ```

  Other runtimes need nothing: Node keeps the process alive.
- **CSP:** `connect-src https://events.mirafive.io` (or your `host`). No `script-src`
  change: the code is part of your own bundle.
- **`astro dev`** sends nothing unless `dev: true`; `window.mirafive` calls then queue
  harmlessly.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Nothing arrives | `astro dev` without `dev: true`; `astro preview` on localhost without `trackLocalhost: true`; the build warned "no website key" (set `PUBLIC_MIRAFIVE_KEY`); Do Not Track, GPC or `__mirafive_ignore`; in mode `"full"`, no `consent(true)` yet. |
| `403 secret_key_in_path` / `website_key_as_bearer` | The key kinds are swapped: `PUBLIC_MIRAFIVE_KEY` is the website key, `MIRAFIVE_SECRET_KEY` the secret key of a server source. |
| `403 origin_not_allowed` | Add the site's origin to the source's allowed origins in MIRA FIVE. |
| A flag always returns its fallback | Not in this source's flags; flags not loaded yet (`mirafive("onFlags", …)`); the page has no `MiraFlagsScript` and reads before the fetch; `MIRAFIVE_SECRET_KEY` missing on the server (a `[mirafive] no key` warning); `evaluate(key)` says why. |
| Back/forward pageviews carry the old title | The page does not run the injected script (a custom `injectScript` setup without `astro()`). |
| `Cannot find module 'astro:env/server'` | `@mirafive/sdk-astro/server` used without `mirafive()` in `integrations`. |

## For AI agents

Copy-paste setup prompt:

```text
Add MIRA FIVE analytics to this Astro site with @mirafive/sdk-astro.
1. Install @mirafive/sdk-astro and @mirafive/sdk-browser with the project's package
   manager (add @mirafive/sdk-server only if server-rendered pages read feature flags).
2. Put the source's website key in .env as PUBLIC_MIRAFIVE_KEY=mf_… (and in the deploy
   environment). If flags are read on the server, put the server source's secret key in
   MIRAFIVE_SECRET_KEY on the server only; never prefix it with PUBLIC_ and never import
   it into client code.
3. Run `npx astro add @mirafive/sdk-astro`, or in astro.config.*: import mirafive from
   "@mirafive/sdk-astro" and add mirafive() to integrations. Do not add a <script> tag
   for MIRA FIVE anywhere.
4. Keep the default consentless mode: it needs no banner. Only if the site already has a
   consent banner and wants ids: mirafive({ mode: "full" }) and, in the banner's accept
   and decline handlers, import { mirafive } from "@mirafive/sdk-astro/client" and call
   mirafive("consent", true) / mirafive("consent", false).
5. Verify: run the build, check that dist HTML has no MIRA FIVE <script src> from another
   origin, deploy (or set trackLocalhost: true and preview), and confirm
   POST https://events.mirafive.io/v1/batch/<key> answers 202 in the network tab. Report
   what you changed.
Do not add other analytics libraries, cookies or consent banners.
```

Facts for agents:

- Imports: `import mirafive from "@mirafive/sdk-astro"` (the integration, default or
  named export, in `astro.config` only; `npx astro add @mirafive/sdk-astro` wires it);
  `import { mirafive } from "@mirafive/sdk-astro/client"` (the command function, in
  browser scripts); `import { miraFlagsFor, MiraFlagsScript } from
  "@mirafive/sdk-astro/server"` (server-rendered pages and endpoints).
- Exact config: `mirafive({ key?, host?, mode?: "consentless" | "full", features?:
  ("autocapture" | "search" | "flags" | "experiments")[], dev?, trackLocalhost? })`.
  `search` and `experiments` need `mode: "full"`; `experiments` implies `flags`.
- Env vars: `PUBLIC_MIRAFIVE_KEY` (website key, public, read at build time),
  `MIRAFIVE_SECRET_KEY` (server only, read at runtime by `miraFlagsFor`),
  `MIRAFIVE_HOST` (optional, server; the browser host is the `host` option).
- Never ship `MIRAFIVE_SECRET_KEY` to a browser bundle: the build fails when the website
  key equals it, a `secretKey` option throws, and a secret key in a URL is refused and
  marked exposed by the server.
- Server flags on Cloudflare: pass `{ waitUntil: (p) => Astro.locals.cfContext.waitUntil(p) }`
  as the third argument of `miraFlagsFor`.
- Consentless (default) needs no banner and sends from the first page. `mode: "full"`
  sends nothing until `mirafive("consent", true)` (or a scoped answer); put it behind the
  site's banner. The same verbs work on `window.mirafive` in inline scripts.
- Pages rendering `MiraFlagsScript` must be on demand (`export const prerender = false`)
  and send `Cache-Control: private, no-store`.
- Nothing throws for transport reasons: browser failures are dropped with a
  `[mirafive] …` warning on local hosts; server flag reads answer the fallback.
- Verify an install: the built page has a `<script type="module" src="/_astro/…">` whose
  code contains the key and no `cdn.mirafive.io` reference; on the deployed site the
  network tab shows `POST …/v1/batch/{key}` answering `202`, and the event appears in the
  source's live view.
- Wire contract: [mirafive/protocol](https://github.com/mirafive/protocol).

## License

[MIT](LICENSE) © 2026 Cloo GmbH
