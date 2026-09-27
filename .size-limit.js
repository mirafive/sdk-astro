// The generated scripts bundle the peer sdk-browser, which size-limit would otherwise leave out.
const bundled = (config) => ({ ...config, external: undefined })

// oxlint-disable-next-line import/no-default-export -- size-limit reads the default export
export default [
  {
    name: "integration (build time, never shipped)",
    path: "dist/index.js",
    import: "{ mirafive }",
    ignore: ["node:url"],
    gzip: true,
    limit: "1.19 kB"
  },
  { name: "client: astro()", path: "dist/client.js", import: "{ astro }", gzip: true, limit: "375 B" },
  { name: "client: mirafive()", path: "dist/client.js", import: "{ mirafive }", gzip: true, limit: "161 B" },
  {
    name: "server",
    path: "dist/server.js",
    import: "{ miraFlagsFor, MiraFlagsScript }",
    ignore: ["astro:env/server", "../components/MiraFlagsScript.astro"],
    gzip: true,
    limit: "302 B"
  },
  {
    name: "baseline: sdk-browser core + pageviews, same key",
    path: "test/size/baseline.js",
    modifyRolldownConfig: bundled,
    gzip: true,
    limit: "2425 B"
  },
  {
    name: "injected script, default config",
    path: "test/size/default.js",
    modifyRolldownConfig: bundled,
    gzip: true,
    limit: "2670 B"
  },
  {
    name: "injected script, full mode with every feature",
    path: "test/size/full.js",
    modifyRolldownConfig: bundled,
    gzip: true,
    limit: "7.22 kB"
  }
]
