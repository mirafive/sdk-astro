import { defineConfig } from "tsdown"

export default defineConfig({
  // One entry per public subpath; each is also in package.json#exports and size-limit.
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
    server: "src/server.ts"
  },
  format: "esm",
  platform: "neutral",
  target: "es2022",
  // Resolved by Astro's Vite in the site's build: the shipped component and the adapter's env.
  deps: { neverBundle: [/^astro:/, /\.astro$/] },
  dts: true,
  sourcemap: false,
  clean: true,
  hash: false,
  fixedExtension: false
})
