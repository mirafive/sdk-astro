import { defineConfig } from "tsdown"

export default defineConfig({
  // One entry per public subpath; each is also in package.json#exports and size-limit.
  entry: {
    index: "src/index.ts",
    client: "src/client.ts"
  },
  format: "esm",
  platform: "neutral",
  target: "es2022",
  dts: true,
  sourcemap: false,
  clean: true,
  hash: false,
  fixedExtension: false
})
