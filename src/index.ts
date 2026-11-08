/**
 * `@mirafive/astro`: MIRA FIVE for Astro, as an integration.
 *
 * ```ts
 * // astro.config.mjs
 * import mirafive from "@mirafive/astro";
 *
 * export default defineConfig({ integrations: [mirafive()] }); // reads PUBLIC_MIRAFIVE_KEY
 * ```
 *
 * Every page gets the browser SDK, bundled by Astro (no third-party script tag). Your own scripts
 * use the same client: `import { mira } from "@mirafive/astro/client"`.
 */
import type { AutocaptureOptions, ConsentChoice } from "@mirafive/web";

export interface MirafiveOptions {
  /** The project's public key (`mira_pk_…`). Default: `PUBLIC_MIRAFIVE_KEY`. */
  key?: string;
  /** Ingest origin. Default: `PUBLIC_MIRAFIVE_HOST`, else `https://events.mirafive.io`. */
  host?: string;
  /** `'auto'` (default) follows the consent banner; an object sets it for custom banners. */
  consent?: "auto" | ConsentChoice;
  /** What the SDK captures on its own; all on by default. */
  autocapture?: boolean | AutocaptureOptions;
  debug?: boolean;
  /** Also send from `astro dev`. Default `false`, so local work stays out of your numbers. */
  dev?: boolean;
}

/** The parts of Astro's integration API this package uses. Compatible with `AstroIntegration`. */
export interface MirafiveIntegration {
  name: string;
  hooks: {
    "astro:config:setup": (params: {
      command: string;
      injectScript: (stage: "page", content: string) => void;
      logger: { info: (message: string) => void; warn: (message: string) => void };
    }) => void;
  };
}

/** The module Astro bundles into every page. */
export function clientScript({ key, host, dev: _, ...options }: MirafiveOptions): string {
  const settings = JSON.stringify(options);
  return [
    `import { mira } from "@mirafive/astro/client";`,
    `const key = ${JSON.stringify(key ?? "")} || import.meta.env.PUBLIC_MIRAFIVE_KEY;`,
    `const host = ${JSON.stringify(host ?? "")} || import.meta.env.PUBLIC_MIRAFIVE_HOST || undefined;`,
    `if (key) mira.init({ ...${settings}, key, host });`,
    `else console.warn("MIRA FIVE: no public key: set PUBLIC_MIRAFIVE_KEY or pass { key } to mirafive(). Nothing is sent.");`,
  ].join("\n");
}

export default function mirafive(options: MirafiveOptions = {}): MirafiveIntegration {
  if (options.key?.startsWith("mira_sk_")) {
    throw new Error(
      "MIRA FIVE: the key passed to mirafive() is a secret key (mira_sk_…). It would ship to every browser: use the project's public key (mira_pk_…).",
    );
  }
  return {
    name: "@mirafive/astro",
    hooks: {
      "astro:config:setup": ({ command, injectScript, logger }) => {
        if (command === "dev" && !options.dev) {
          logger.info("off under astro dev; pass { dev: true } to send from the dev server");
          return;
        }
        if (command !== "dev" && command !== "build") return;
        injectScript("page", clientScript(options));
      },
    },
  };
}
