import type { Mira, Page, Plugin, Properties } from "@mirafive/sdk-browser"

/**
 * `mirafive(verb, ...args)`: the hosted tracker's verbs (a client method by name, plus `flags` and
 * `flagProperties`), queued until the client runs; `undefined` while queued.
 */
export interface MirafiveCommand {
  (verb: "anonymousId", callback: (anonymousId: string | undefined) => void): string | undefined
  (verb: "flags", listener: () => void): (() => void) | undefined
  (verb: "flagProperties", properties: Properties): undefined
  <Name extends keyof Mira>(verb: Name, ...args: Parameters<Mira[Name]>): ReturnType<Mira[Name]> | undefined
}

type Command = ((verb: string, ...args: unknown[]) => unknown) & { q?: ArrayLike<unknown>[] }
type Host = { mirafive?: Command }

// A flag read replayed after start would count an exposure for a value the page never showed.
const reads = /^(flag|config)$/

/**
 * The Astro plugin of the generated script: runs `window.mirafive` commands (queued ones first)
 * and, under `<ClientRouter />`, sends a navigation's pageview once the new page is in place.
 */
export const astro = (): Plugin => ({
  name: "astro",
  setup(core) {
    const w = window as Window & Host
    const d = document
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every member is a method
    const client = core.client as unknown as Record<string, ((...args: unknown[]) => unknown) | undefined>
    // oxlint-disable-next-line typescript/unbound-method -- the core's methods are arrow functions
    const { pageview } = core.client
    const queued = w.mirafive?.q ?? []
    const command: Command = (verb, ...args) => {
      const method =
        client[verb === "flags" ? "onFlags" : verb === "flagProperties" ? "setFlagProperties" : verb]

      if (!method) {
        return core.warn(`unknown verb ${verb}`)
      }

      const answer = method(...args)

      // The tracker's anonymousId verb answers to a callback, which also works while queued.
      if (verb === "anonymousId" && typeof args[0] === "function") {
        args[0](answer)
      }

      return answer
    }
    // 1 while the router prepares a page, then the pageview it holds until the page has loaded.
    let held: Page | 0 | 1 = 0

    // On back and forward the router changes the URL before it fetches the page, so the title would be the old one.
    d.addEventListener("astro:before-preparation", () => (held = 1))
    d.addEventListener("astro:page-load", () => {
      if (held !== 1 && held) {
        pageview(held)
      }

      held = 0
    })
    core.expose({ pageview: (page?: Page) => (held ? (held = page ?? {}) : pageview(page)) })
    w.mirafive = command

    for (const args of queued) {
      if (!reads.test(String(args[0]))) {
        Reflect.apply(command, undefined, args)
      }
    }
  }
})

/**
 * Calls a client method by name, from any script or island. Before the client has started the call
 * is queued on `window.mirafive`, the same queue the hosted tracker snippet uses; `flag` and `config`
 * answer their fallback then and are not queued.
 */
export const mirafive = ((verb: string, ...args: unknown[]): unknown => {
  if (typeof window === "undefined") {
    return undefined
  }

  const w = window as Window & Host

  if (!w.mirafive || w.mirafive.q) {
    if (reads.test(verb)) {
      return args[1]
    }

    if (!w.mirafive) {
      const q: ArrayLike<unknown>[] = []

      w.mirafive = Object.assign((...queued: unknown[]) => void q.push(queued), { q })
    }
  }

  return w.mirafive(verb, ...args)
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the running client answers for its method
}) as MirafiveCommand
