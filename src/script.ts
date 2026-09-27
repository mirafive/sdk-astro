export type Feature = "autocapture" | "search" | "flags" | "experiments"

export interface ScriptConfig {
  key: string
  host?: string | undefined
  mode: "consentless" | "full"
  features: readonly Feature[]
  trackLocalhost: boolean
}

const plugins = [
  ["pageviews", "pageviews"],
  ["identity", "identity"],
  ["autocapture", "autocapture"],
  ["search", "siteSearch"],
  ["flags", "flags"],
  ["experiments", "experiments"]
] as const

/** The module injected into every page: the core, the configured plugin subpaths and nothing else. */
export const clientScript = (
  { key, host, mode, features, trackLocalhost }: ScriptConfig,
  resolve: (specifier: string) => string = (specifier) => specifier
): string => {
  const wanted = new Set<string>(["pageviews", ...(mode === "full" ? ["identity"] : []), ...features])
  const used = plugins.filter(([path]) => wanted.has(path))
  const options = JSON.stringify({
    key,
    ...(host === undefined ? {} : { host }),
    ...(mode === "full" ? { mode } : {}),
    ...(trackLocalhost ? { trackLocalhost } : {})
  })

  const from = (specifier: string): string => JSON.stringify(resolve(specifier))

  return [
    `import { createMira } from ${from("@mirafive/sdk-browser")}`,
    ...used.map(([path, name]) => `import { ${name} } from ${from(`@mirafive/sdk-browser/${path}`)}`),
    `import { astro } from ${from("@mirafive/sdk-astro/client")}`,
    "",
    `createMira({ ${options.slice(1, -1)}, plugins: [${[...used.map(([, name]) => `${name}()`), "astro()"].join(", ")}] })`,
    ""
  ].join("\n")
}
