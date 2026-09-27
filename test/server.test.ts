import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { miraFlagsFor } from "../src/flags.ts"

const SECRET = "mf_sk_test_0123456789abcdefghijklmnop"

const document = {
  v: 1,
  at: Date.now(),
  flags: {
    "new-checkout": {
      s: "abcdefghijkl",
      t: "b",
      u: "p",
      d: "off",
      r: [{ if: [["s", "3fa9c1e07b"]], x: "on" }],
      w: 1
    },
    "server-only": { s: "bcdefghijklm", t: "b", u: "b", d: "on", r: [] }
  }
}

let documents = 0
const calls: { url: string; method: string; authorization: string | null; body?: string }[] = []

const fetchMock = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
  const url = String(input)
  const headers = new Headers(init.headers)

  calls.push({
    url,
    method: init.method ?? "GET",
    authorization: headers.get("authorization"),
    ...(typeof init.body === "string" ? { body: init.body } : {})
  })

  if (url.endsWith("/v1/flags/segments")) {
    const { units } = JSON.parse(init.body as string) as { units: unknown[] }

    return Response.json({
      units: units.map(() => ({
        segments: ["3fa9c1e07b"],
        unavailable: [],
        refreshedAt: Date.now(),
        stale: false
      }))
    })
  }

  documents += 1

  return Response.json(document, { headers: { etag: 'W/"f-1"' } })
})

const request = (headers: Record<string, string> = {}) => ({
  request: new Request("https://shop.example/", { headers })
})

beforeAll(() => {
  vi.stubEnv("MIRAFIVE_SECRET_KEY", SECRET)
  vi.stubGlobal("fetch", fetchMock)
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("miraFlagsFor()", () => {
  it("reads the server document and segments with the secret key", async () => {
    const user = await miraFlagsFor(request(), { userId: "u_42" })

    expect(user.enabled("new-checkout")).toBe(true)
    expect(calls.map((call) => [call.method, new URL(call.url).pathname, call.authorization])).toEqual([
      ["GET", "/v1/flags", `Bearer ${SECRET}`],
      ["POST", "/v1/flags/segments", `Bearer ${SECRET}`]
    ])
  })

  it("bootstraps only the flags the website reads", async () => {
    const block = (await miraFlagsFor(request(), { userId: "u_42" })).bootstrap()

    expect(block).toMatch(/^<script type="application\/json" id="mirafive-flags">/)
    expect(block).toContain('"new-checkout":["on"]')
    expect(block).not.toContain("server-only")
  })

  it.each([["sec-gpc"], ["dnt"]])("treats %s: 1 as an opt-out: no segment lookup", async (header) => {
    calls.length = 0

    const user = await miraFlagsFor(request({ [header]: "1" }), { userId: `u_${header}` })

    expect(user.enabled("new-checkout")).toBe(false)
    expect(calls.filter((call) => call.url.endsWith("/segments"))).toEqual([])
  })

  it("keeps an explicit opt-out and shares one document between requests", async () => {
    calls.length = 0

    const user = await miraFlagsFor(request(), { userId: "u_7", optedOut: true })

    expect(user.enabled("new-checkout")).toBe(false)
    expect(calls).toEqual([])
    expect(documents).toBe(1)
  })

  it("hands a due refresh to the request's waitUntil", async () => {
    const waitUntil = vi.fn()

    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(Date.now() + 60_000)
    await miraFlagsFor(request(), {}, { waitUntil })
    vi.useRealTimers()

    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise))
    expect(documents).toBe(2)
  })
})
