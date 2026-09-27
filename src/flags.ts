import { Mira } from "@mirafive/sdk-server"
import { type FlagUnit, type ForOptions, MiraFlags, type UserFlags } from "@mirafive/sdk-server/flags"
import { getSecret } from "astro:env/server"

let flags: MiraFlags | undefined

/**
 * One visitor's flags, from a `MiraFlags` shared by every request and keyed by `MIRAFIVE_SECRET_KEY`;
 * its `Mira` sends the exposures of experiments counted on the server.
 * `Sec-GPC: 1` or `DNT: 1` on the request sets `optedOut`. On Workers pass this request's `waitUntil`.
 */
export const miraFlagsFor = (
  context: { request: Request },
  unit: FlagUnit = {},
  options: ForOptions = {}
): Promise<UserFlags> => {
  const { headers } = context.request

  if (!flags) {
    const key = getSecret("MIRAFIVE_SECRET_KEY")
    const host = getSecret("MIRAFIVE_HOST")

    flags = new MiraFlags({ key, host, mira: new Mira({ key, host }) })
  }

  return flags.for(
    { ...unit, optedOut: unit.optedOut || headers.get("sec-gpc") === "1" || headers.get("dnt") === "1" },
    options
  )
}
