import node from "@astrojs/node"
import mirafive from "@mirafive/sdk-astro"
import { defineConfig } from "astro/config"

// `EXAMPLE_MODE=full astro build` builds the banner-gated variant.
const full = process.env.EXAMPLE_MODE === "full"

export default defineConfig({
  adapter: node({ mode: "standalone" }),
  integrations: [mirafive(full ? { mode: "full", features: ["autocapture", "flags"] } : {})]
})
