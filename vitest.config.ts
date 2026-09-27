import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "astro:env/server": fileURLToPath(new URL("test/astro-env.ts", import.meta.url)) }
  },
  test: {
    include: ["test/**/*.test.ts"]
  }
})
