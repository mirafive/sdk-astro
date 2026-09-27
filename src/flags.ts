import { type ForOptions, MiraFlags, type FlagUnit, type UserFlags } from "@mirafive/sdk-server/flags"
import { getSecret } from "astro:env/server"

let flags: MiraFlags | undefined

/**
 * One visitor's flags, from a `MiraFlags` shared by every request and keyed by `MIRAFIVE_SECRET_KEY`.
 * `Sec-GPC: 1` or `DNT: 1` on the request sets `optedOut`. On Workers pass this request's `waitUntil`.
 */
export const miraFlagsFor = (
  context: { request: Request },
  unit: FlagUnit = {},
  options: ForOptions = {}
): Promise<UserFlags> => {
  const { headers } = context.request

  flags ??= new MiraFlags({ key: getSecret("MIRAFIVE_SECRET_KEY"), host: getSecret("MIRAFIVE_HOST") })

  return flags.for(
    {
      ...unit,
      optedOut: unit.optedOut || headers.get("sec-gpc") === "1" || headers.get("dnt") === "1"
    },
    options
  )
}
