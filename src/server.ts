import type { UserFlags } from "@mirafive/sdk-server/flags"

import Component from "../components/MiraFlagsScript.astro"

export { miraFlagsFor } from "./flags.ts"

export interface MiraFlagsScriptProps {
  /** What `miraFlagsFor()` answered for this request. */
  flags: UserFlags
}

/** Renders the bootstrap block the browser SDK reads at start. Send `Cache-Control: private, no-store` with the page. */
export const MiraFlagsScript: (props: MiraFlagsScriptProps) => unknown = Component
