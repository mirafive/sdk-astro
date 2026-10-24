# Changelog

## Unreleased

- Revenue events may carry `payment_id`, the payment provider's id of the payment (1–255 characters), next to `revenue` and `currency`. Nothing changes in the API: pass it in the properties. The README shows a Stripe example.
- The default ingest host is `https://collect.mirafive.io`.

- **Breaking:** feature flags and A/B experiments are removed. `features` no longer
  accepts `"flags"` or `"experiments"` (the integration throws for them), the
  `@mirafive/sdk-astro/server` entry (`miraFlagsFor`, `MiraFlagsScript`) is gone, and the
  optional peer `@mirafive/sdk-server` is no longer used. `mirafive()` from
  `@mirafive/sdk-astro/client` no longer takes the `flags` and `flagProperties` verbs and
  queues every verb, as `flag` and `config` no longer exist.
- Consent: statistics is the only purpose. The `experiments` and `targeting` purposes are
  gone. `mirafive("consent", { experiments, targeting })` from an existing site still
  works; sdk-browser accepts and ignores the keys.


## 1.0.0 — 2026-09-27

Rebuilt from scratch as a thin layer over `@mirafive/sdk-browser` and
`@mirafive/sdk-server` 1.0 on the v1 protocol.

- `mirafive({ key, host, mode, features, dev, trackLocalhost })`: injects one module
  per page that imports only the sdk-browser subpaths the config needs (pageviews,
  identity in full mode, then `autocapture`, `search`, `flags`, `experiments`). The key
  defaults to `PUBLIC_MIRAFIVE_KEY`. Off under `astro dev` unless `dev: true`. Refuses a
  secret key, unknown modes and features, a host without a scheme, and full-mode
  features in consentless mode. Named and default export, so `astro add` works. The
  default script is 235 B over the same `createMira` call without this package. Imports
  are resolved from this package, so strict installs (pnpm) without a direct
  sdk-browser dependency work.
- `@mirafive/sdk-astro/client`: `mirafive(verb, ...args)` with the hosted tracker's
  verbs (`flags`, `flagProperties`, `anonymousId` with a callback; `flag`/`config` answer
  the fallback before start and are never queued or replayed; unknown verbs warn in
  development), queued on `window.mirafive`
  (compatible with the hosted tracker's stub) until the client runs, so a consent banner
  can call `mirafive("consent", …)` from any script; `astro()` plugin, which also holds a
  `<ClientRouter />` back/forward pageview until `astro:page-load` so it carries the new
  page's title.
- `@mirafive/sdk-astro/server`: `miraFlagsFor(context, unit, { waitUntil? })` over one `MiraFlags` per
  process (`MIRAFIVE_SECRET_KEY` via `astro:env/server`) and one `Mira` that sends
  server-counted exposures, with `Sec-GPC`/`DNT` as
  `optedOut`; `MiraFlagsScript` renders the bootstrap block.
