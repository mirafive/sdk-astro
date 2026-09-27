import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { AstroIntegration, HookParameters } from "astro"
import { afterEach, describe, expect, it, vi } from "vitest"

import { mirafive as run } from "../src/client.ts"
import defaultExport, { type MirafiveOptions, mirafive } from "../src/index.ts"

const KEY = "mf_ab12cd34_0123456789abcdefghijklmnop"

interface VitePlugin {
  configResolved(config: { env: Record<string, unknown> }): void
  resolveId(id: string): string | undefined
  load(id: string): string | undefined
}

const setup = (
  options: MirafiveOptions,
  {
    command = "build",
    env = { PUBLIC_MIRAFIVE_KEY: KEY }
  }: { command?: string; env?: Record<string, unknown> } = {}
) => {
  const injected: [string, string][] = []
  const logs = { info: vi.fn(), warn: vi.fn() }
  let vite: { ssr: { noExternal: string[] }; plugins: VitePlugin[] } | undefined
  const integration: AstroIntegration = mirafive(options)

  void integration.hooks["astro:config:setup"]?.({
    command,
    injectScript: (stage: string, content: string) => injected.push([stage, content]),
    updateConfig: (config: { vite: typeof vite }) => (vite = config.vite),
    logger: logs
  } as unknown as HookParameters<"astro:config:setup">)

  const [plugin] = vite?.plugins ?? []

  plugin?.configResolved({ env })

  const script = (): string | undefined => {
    const id = plugin?.resolveId("virtual:mirafive/astro")

    return id === undefined ? undefined : plugin?.load(id)
  }

  return { injected, logs, vite, script }
}

const read = (name: string): string => readFileSync(join(import.meta.dirname, "size", name), "utf8")

const imports = (script = ""): string[] =>
  [...script.matchAll(/from "(@mirafive\/[^"]+)"/g)].map(([, path]) => path ?? "")

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("integration", () => {
  it("is also the default export, for astro add", () => {
    expect(defaultExport).toBe(mirafive)
  })

  it("injects the core and pageviews with the key from PUBLIC_MIRAFIVE_KEY", () => {
    const { injected, script, vite } = setup({})

    expect(injected).toEqual([["page", 'import "virtual:mirafive/astro"']])
    expect(vite?.ssr.noExternal).toEqual(["@mirafive/sdk-astro"])
    expect(script()).toBe(
      [
        'import { createMira } from "@mirafive/sdk-browser"',
        'import { pageviews } from "@mirafive/sdk-browser/pageviews"',
        'import { astro } from "@mirafive/sdk-astro/client"',
        "",
        `createMira({ "key":"${KEY}", plugins: [pageviews(), astro()] })`,
        ""
      ].join("\n")
    )
  })

  it("prefers the key option, trims it and passes host", () => {
    const { script } = setup({ key: ` ${KEY}_x `, host: "https://m.example.com" })

    expect(script()).toContain(`{ "key":"${KEY}_x","host":"https://m.example.com", plugins`)
  })

  it.each<[MirafiveOptions, string[]]>([
    [{}, ["pageviews"]],
    [{ features: ["autocapture"] }, ["pageviews", "autocapture"]],
    [{ features: ["flags"] }, ["pageviews", "flags"]],
    [{ mode: "full" }, ["pageviews", "identity"]],
    [{ mode: "full", features: ["search"] }, ["pageviews", "identity", "search"]],
    [{ mode: "full", features: ["experiments"] }, ["pageviews", "identity", "flags", "experiments"]],
    [
      { mode: "full", features: ["experiments", "flags", "search", "autocapture", "flags"] },
      ["pageviews", "identity", "autocapture", "search", "flags", "experiments"]
    ]
  ])("bundles only the plugin subpaths for %j", (options, plugins) => {
    const script = setup(options).script()

    expect(imports(script)).toEqual([
      "@mirafive/sdk-browser",
      ...plugins.map((plugin) => `@mirafive/sdk-browser/${plugin}`),
      "@mirafive/sdk-astro/client"
    ])
    expect(script?.includes('"mode":"full"')).toBe(options.mode === "full")
  })

  it("keeps the generated scripts measured by size-limit current", () => {
    expect(setup({ key: KEY }).script()).toBe(read("default.js"))
    expect(
      setup({ key: KEY, mode: "full", features: ["autocapture", "search", "flags", "experiments"] }).script()
    ).toBe(read("full.js"))
  })

  it.each<[Record<string, unknown>, RegExp]>([
    [{ features: ["search"] }, /"search" needs mode "full"/],
    [{ features: ["experiments"] }, /"experiments" needs mode "full"/],
    [{ features: ["clicks"] }, /unknown feature "clicks"/],
    [{ mode: "anonymous" }, /unknown mode "anonymous"/],
    [{ host: "events.example.com" }, /host needs a scheme/],
    [{ secretKey: "sk_live" }, /secret keys are server-only/]
  ])("refuses %j", (options, message) => {
    expect(() => mirafive(options as MirafiveOptions)).toThrow(message)
  })

  it("refuses MIRAFIVE_SECRET_KEY as the website key", () => {
    vi.stubEnv("MIRAFIVE_SECRET_KEY", KEY)

    expect(() => setup({}).script()).toThrow(/the key is MIRAFIVE_SECRET_KEY/)
  })

  it("injects nothing but a warning without a key", () => {
    const { script, logs } = setup({}, { env: {} })

    expect(script()).toBe("")
    expect(logs.warn).toHaveBeenCalledWith(expect.stringMatching(/no website key/))
  })

  it("stays off under astro dev", () => {
    const { injected, logs, vite } = setup({}, { command: "dev" })

    expect(injected).toEqual([])
    expect(vite?.plugins).toEqual([])
    expect(vite?.ssr.noExternal).toEqual(["@mirafive/sdk-astro"])
    expect(logs.info).toHaveBeenCalledWith(expect.stringMatching(/dev: true/))
  })

  it("runs under astro dev with dev: true, sending from localhost there only", () => {
    expect(setup({ dev: true }, { command: "dev" }).script()).toContain('"trackLocalhost":true')
    expect(setup({ dev: true, trackLocalhost: false }, { command: "dev" }).script()).not.toContain(
      "trackLocalhost"
    )
    expect(setup({ dev: true }).script()).not.toContain("trackLocalhost")
    expect(setup({ trackLocalhost: true }).script()).toContain('"trackLocalhost":true')
  })
})

describe("mirafive() on the server", () => {
  it("does nothing without a window", () => {
    expect(run("track", "signup")).toBeUndefined()
  })
})
