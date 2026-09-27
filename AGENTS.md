# Agents working in mirafive/sdk-astro

`@mirafive/sdk-astro`: the Astro integration (bundles `@mirafive/sdk-browser` into the
site's own JavaScript) and server-rendered flags. Part of the MIRA FIVE SDK family; the
wire contract, flag semantics and public API live in
[mirafive/protocol](https://github.com/mirafive/protocol) (PROTOCOL.md, FLAGS.md,
API.md).

## Commands

```sh
bun install --frozen-lockfile
bun run check            # format, lint, typecheck, test, build, publint, attw, size-limit
bun run test             # vitest (happy-dom for test/client.test.ts)
bun run size             # size-limit against the limits in .size-limit.js
bun run example          # build first, then: npm install and astro build (default and full) in example/
```

## Layout

- `src/index.ts`: the integration. It injects `import "virtual:mirafive/astro"`; a Vite
  plugin answers that module from `src/script.ts` once Vite has loaded the env, so the
  key comes from `PUBLIC_MIRAFIVE_KEY` in any `.env`/mode. Its imports are file paths
  resolved from this package (`import.meta.resolve`), not bare names, for pnpm.
- `src/client.ts`: `astro()` (`window.mirafive` and the `<ClientRouter />` pageview hold)
  and the `mirafive()` command. Browser code: bytes count.
- `src/server.ts`, `src/flags.ts`, `components/MiraFlagsScript.astro`: the server entry.
  The component ships as `.astro` source; `astro:env/server` and the component stay
  external in `dist/server.js` and are resolved by the site's Vite.
- `test/size/*.js`: the generated scripts size-limit measures; `test/integration.test.ts`
  fails when the generator drifts from them. `baseline.js` is the same `createMira` call
  without this package.
- `example/`: an Astro 7 site (node adapter, one on-demand page) on this package
  (`file:..`) and the published sdk-browser/sdk-server. Installed with npm. Not in the npm
  package.

## Rules

- API.md is the contract for this package's public surface. Do not add, rename or
  remove exports without changing API.md first.
- Thin: no transport, no evaluator. Everything goes through sdk-browser's `MiraCore`
  and sdk-server's `MiraFlags`; `context.sdk` stays what the SDK reports.
- Bundle size: the default injected script stays within ~240 B (min + gzip) of
  `baseline.js` (the goal was 150 B; the tracker verbs, the flag-read guard and the
  unknown-verb warning cost ~100 B). Limits in
  `.size-limit.js` are the measured size plus ~3 %. Grow `astro()` only with a reason in
  the change.
- The injected script imports only the sdk-browser subpaths the config needs; keep the
  plugin order pageviews, identity, autocapture, search, flags, experiments, astro
  (`astro()` last, so queued consent reaches identity before the landing pageview).
- Each entry is its own subpath; `sideEffects: false` must stay true.
- Transport failures never throw into the caller's code (API.md, shared rules).
- A secret key never reaches browser code: the integration refuses `secretKey` and a
  key equal to `MIRAFIVE_SECRET_KEY`.
- Comments only for a non-obvious constraint, one or two lines.
- Do not run git write commands unless asked; the maintainer commits.

## Dependencies

sdk-browser and sdk-server are ordinary `^1.0.0` dependencies from npm. To try an
unreleased change, build the sibling repo and `bun link` it; never commit a `file:` path
or `overrides`.

## Releasing

To release, bump `version` in `package.json` (and any SDK version constant), add a `## X.Y.Z — YYYY-MM-DD` section to `CHANGELOG.md`, commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`. `.github/workflows/release.yml` checks both, runs `bun run check`, publishes to npm through trusted publishing (no token) and creates the GitHub release from the changelog section. Never `npm publish` from a laptop.
