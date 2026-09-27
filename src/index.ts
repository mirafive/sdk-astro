import type { AstroIntegration } from "astro"

import { clientScript, type Feature } from "./script.ts"

export type { Feature } from "./script.ts"

export interface MirafiveOptions {
  /** The source's website key (`mf_…`). Default: `PUBLIC_MIRAFIVE_KEY`. */
  key?: string
  /** Default `https://events.mirafive.io`. */
  host?: string
  /** Default `"consentless"`. `"full"` adds `identity()` and waits for `consent()`. */
  mode?: "consentless" | "full"
  /** Plugins bundled besides pageviews. `experiments` brings `flags`; `search` and `experiments` need mode `"full"`. */
  features?: Feature[]
  /** Also run under `astro dev` (and send from localhost there). Default `false`. */
  dev?: boolean
  /** Also send from `localhost`, `127.*`, `[::1]`, `*.local` and `file:`. */
  trackLocalhost?: boolean
}

const known: readonly Feature[] = ["autocapture", "search", "flags", "experiments"]
const virtual = "virtual:mirafive/astro"

const fail = (message: string): never => {
  throw new TypeError(`[@mirafive/sdk-astro] ${message}`)
}

/** Bundles `@mirafive/sdk-browser` into every page, with only the plugins `features` names. */
export const mirafive = (options: MirafiveOptions = {}): AstroIntegration => {
  const { host, mode = "consentless", dev = false } = options
  const features = new Set(options.features)

  if ("secretKey" in options) {
    fail("secret keys are server-only: pass the website key as `key`")
  }

  if (mode !== "consentless" && mode !== "full") {
    fail(`unknown mode "${String(mode)}"`)
  }

  if (host !== undefined && !/^https?:\/\/./.test(host)) {
    fail("host needs a scheme")
  }

  for (const feature of features) {
    if (!known.includes(feature)) {
      fail(`unknown feature "${feature}"`)
    }

    if (mode !== "full" && (feature === "search" || feature === "experiments")) {
      fail(`"${feature}" needs mode "full"`)
    }
  }

  if (features.has("experiments")) {
    features.add("flags")
  }

  return {
    name: "@mirafive/sdk-astro",
    hooks: {
      "astro:config:setup": ({ command, injectScript, updateConfig, logger }) => {
        const on = command !== "dev" || dev
        let env: Record<string, string | undefined> = {}

        updateConfig({
          vite: {
            ssr: { noExternal: ["@mirafive/sdk-astro"] },
            plugins: on
              ? [
                  {
                    name: "mirafive:astro",
                    configResolved: (config) => void (env = config.env),
                    resolveId: (id) => (id === virtual ? `\0${virtual}` : undefined),
                    load: (id) => {
                      if (id !== `\0${virtual}`) {
                        return undefined
                      }

                      const key = (options.key ?? env["PUBLIC_MIRAFIVE_KEY"] ?? "").trim()

                      if (key && key === process.env["MIRAFIVE_SECRET_KEY"]?.trim()) {
                        fail(
                          "the key is MIRAFIVE_SECRET_KEY: browsers get the website key, never the secret key"
                        )
                      }

                      if (!key) {
                        logger.warn("no website key: set PUBLIC_MIRAFIVE_KEY or pass `key`; nothing is sent")

                        return ""
                      }

                      return clientScript({
                        key,
                        host,
                        mode,
                        features: known.filter((feature) => features.has(feature)),
                        trackLocalhost: options.trackLocalhost ?? (command === "dev" && dev)
                      })
                    }
                  }
                ]
              : []
          }
        })

        if (on) {
          injectScript("page", `import "${virtual}"`)
        } else {
          logger.info("off under `astro dev`; pass `dev: true` to send from the dev server")
        }
      }
    }
  }
}

// oxlint-disable-next-line import/no-default-export -- `astro add` imports the integration by its default export
export default mirafive
