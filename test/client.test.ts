// @vitest-environment happy-dom
import { createMira, type Mira, type MiraOptions } from "@mirafive/sdk-browser"
import { identity } from "@mirafive/sdk-browser/identity"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { astro, mirafive } from "../src/client.ts"

const KEY = "mf_ab12cd34_0123456789abcdefghijklmnop"

interface Sent {
  mode: string
  events: { name: string; properties?: Record<string, unknown>; page?: Record<string, string> }[]
}

const w = window as unknown as Window & Record<string, unknown> & { happyDOM: { setURL(url: string): void } }
const sent: Sent[] = []
const clients: Mira[] = []

const start = (options: Partial<MiraOptions> = {}): Mira => {
  const client = createMira({ key: KEY, plugins: [pageviews(), astro()], ...options })

  clients.push(client)
  return client
}

const events = () => sent.flatMap((batch) => batch.events)
const pageviewsSent = () => events().filter((event) => event.name === "$pageview")
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms)
const astroEvent = (type: string) => document.dispatchEvent(new Event(`astro:${type}`))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const batch = JSON.parse(init.body as string) as Sent

      sent.push(batch)
      return Response.json({ accepted: batch.events.length, dropped: 0 }, { status: 202 })
    })
  )
  w.happyDOM.setURL("https://shop.example/")
  document.title = "Home"
})

afterEach(() => {
  clients.splice(0).forEach((client) => client.destroy())
  sent.length = 0
  delete w["mirafive"]
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("window.mirafive", () => {
  it("runs calls queued before the client started, then calls straight through", async () => {
    mirafive("track", "early", { from: "helper" })
    ;(w["mirafive"] as (...args: unknown[]) => void)("track", "late")

    const client = start({ plugins: [astro()] })

    expect(mirafive("flag", "missing", true)).toBe(true)
    mirafive("track", "running")
    await client.flush()

    expect(events().map((event) => event.name)).toEqual(["early", "late", "running"])
    expect(events()[0]?.properties).toEqual({ from: "helper" })
  })

  it("drains the hosted tracker snippet's queue of arguments objects", async () => {
    // The snippet from the hosted tracker's docs, as a site may already carry it.
    // oxlint-disable-next-line prefer-rest-params
    w["mirafive"] = function (this: unknown) {
      const stub = w["mirafive"] as { q?: unknown[] }

      ;(stub.q ??= []).push(arguments)
    }
    ;(w["mirafive"] as (...args: unknown[]) => void)("track", "snippet", { a: 1 })

    const client = start({ plugins: [astro()] })

    await client.flush()

    expect(events()).toMatchObject([{ name: "snippet", properties: { a: 1 } }])
  })

  it("hands a banner's early consent to identity before the landing pageview", async () => {
    mirafive("consent", true)

    const client = start({ mode: "full", plugins: [pageviews(), identity(), astro()] })

    await tick()
    await client.flush()

    expect(sent.map((batch) => batch.mode)).toEqual(["full"])
    expect(pageviewsSent()).toHaveLength(1)
  })

  it("answers anonymousId to a callback, queued or not", async () => {
    const early = vi.fn()
    const late = vi.fn()

    mirafive("consent", true)
    mirafive("anonymousId", early)
    start({ mode: "full", plugins: [identity(), astro()] })
    mirafive("anonymousId", late)

    expect(early).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f-]{36}$/))
    expect(late).toHaveBeenCalledWith(early.mock.calls[0]?.[0])
  })

  it("takes the tracker's flags and flagProperties verbs", () => {
    const onFlags = vi.fn(() => () => undefined)
    const setFlagProperties = vi.fn()

    start({
      plugins: [{ name: "flags", setup: (core) => core.expose({ onFlags, setFlagProperties }) }, astro()]
    })

    const listener = vi.fn()

    expect(mirafive("flags", listener)).toBeTypeOf("function")
    mirafive("flagProperties", { plan: "pro" })

    expect(onFlags).toHaveBeenCalledWith(listener)
    expect(setFlagProperties).toHaveBeenCalledWith({ plan: "pro" })
  })

  it("answers queued flag reads with the fallback and never replays them", async () => {
    const flag = vi.fn(() => "b")
    const config = vi.fn()

    expect(mirafive("flag", "pricing-test", "a")).toBe("a")
    expect(mirafive("config", "limits", { max: 1 })).toEqual({ max: 1 })
    expect(w["mirafive"]).toBeUndefined()
    // The hosted tracker's stub queues everything; the plugin skips the reads when it replays.
    w["mirafive"] = Object.assign(() => undefined, {
      q: [
        ["flag", "pricing-test", "a"],
        ["track", "kept"]
      ]
    })
    const client = start({
      plugins: [{ name: "flags", setup: (core) => core.expose({ flag, config }) }, astro()]
    })

    await client.flush()
    expect(flag).not.toHaveBeenCalled()
    expect(config).not.toHaveBeenCalled()
    expect(events().map((event) => event.name)).toEqual(["kept"])
    expect(mirafive("flag", "pricing-test", "a")).toBe("b")
    expect(flag).toHaveBeenCalledWith("pricing-test", "a")
  })

  it("warns about unknown verbs in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    w.happyDOM.setURL("http://localhost/")
    start({ plugins: [astro()] })
    ;(w["mirafive"] as (...args: unknown[]) => void)("trak", "typo")

    expect(warn).toHaveBeenCalledWith("[mirafive] unknown verb trak")
    warn.mockRestore()
  })

  it("sends nothing once the client is destroyed", async () => {
    const client = start()

    await tick()
    client.destroy()
    mirafive("track", "after")
    astroEvent("before-preparation")
    history.pushState({}, "", "/gone")
    astroEvent("page-load")
    await tick()
    await client.flush()

    expect(sent).toEqual([])
  })
})

describe("<ClientRouter /> navigations", () => {
  it("holds a back navigation's pageview until the new page has loaded", async () => {
    const client = start()

    await tick()
    astroEvent("before-preparation")
    // The router's popstate: the URL changes first, the page arrives later.
    w.happyDOM.setURL("https://shop.example/pricing")
    window.dispatchEvent(new PopStateEvent("popstate"))
    await tick(50)
    expect(pageviewsSent()).toHaveLength(0)
    await client.flush()
    expect(pageviewsSent()).toHaveLength(1)

    document.title = "Pricing"
    astroEvent("page-load")
    await client.flush()

    expect(pageviewsSent().map((event) => event.page)).toEqual([
      { url: "https://shop.example/", title: "Home" },
      { url: "https://shop.example/pricing", title: "Pricing", referrer: "https://shop.example/" }
    ])
  })

  it("sends a forward navigation once, whether the page loads before or after the pageview", async () => {
    const client = start()

    await tick()
    astroEvent("before-preparation")
    document.title = "A"
    history.pushState({}, "", "/a")
    astroEvent("page-load")
    await tick()
    astroEvent("before-preparation")
    document.title = "B"
    astroEvent("page-load")
    history.pushState({}, "", "/b")
    await tick()
    await client.flush()

    expect(pageviewsSent().map((event) => [event.page?.["url"], event.page?.["title"]])).toEqual([
      ["https://shop.example/", "Home"],
      ["https://shop.example/a", "A"],
      ["https://shop.example/b", "B"]
    ])
  })

  it("leaves pageviews alone without the router's events", async () => {
    const client = start()

    await tick()
    history.pushState({}, "", "/plain")
    document.title = "Plain"
    await tick()
    astroEvent("page-load")
    await client.flush()

    expect(pageviewsSent().map((event) => event.page?.["title"])).toEqual(["Home", "Plain"])
  })
})
