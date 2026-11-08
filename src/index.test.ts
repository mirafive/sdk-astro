import { describe, expect, test } from "bun:test";

import mirafive, { clientScript } from "./index";

function setup(command: string, options = {}) {
  const scripts: [string, string][] = [];
  const logs: string[] = [];
  mirafive(options).hooks["astro:config:setup"]({
    command,
    injectScript: (stage, content) => scripts.push([stage, content]),
    logger: { info: (message) => logs.push(message), warn: (message) => logs.push(message) },
  });
  return { scripts, logs };
}

describe("@mirafive/astro", () => {
  test("injects the client on every page of a build", () => {
    const { scripts } = setup("build", { consent: { analytics: true } });
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.[0]).toBe("page");
    expect(scripts[0]?.[1]).toContain(`import { mira } from "@mirafive/astro/client";`);
    expect(scripts[0]?.[1]).toContain("import.meta.env.PUBLIC_MIRAFIVE_KEY");
    expect(scripts[0]?.[1]).toContain(`{"consent":{"analytics":true}}`);
  });

  test("stays off under astro dev unless asked", () => {
    expect(setup("dev").scripts).toHaveLength(0);
    expect(setup("dev").logs[0]).toContain("dev: true");
    expect(setup("dev", { dev: true }).scripts).toHaveLength(1);
    expect(setup("preview").scripts).toHaveLength(0);
  });

  test("refuses a secret key", () => {
    expect(() => mirafive({ key: "mira_sk_live" })).toThrow("secret key");
  });

  test("the script is valid JavaScript and escapes the options", () => {
    const script = clientScript({ key: 'mira_pk_"quoted"', host: "https://ingest.example" });
    expect(script).toContain(String.raw`"mira_pk_\"quoted\""`);
    expect(script).not.toContain("dev");
    // Parses as a module, and imports only the client.
    const { imports } = new Bun.Transpiler({ loader: "js" }).scan(script);
    expect(imports.map((item) => item.path)).toEqual(["@mirafive/astro/client"]);
  });
});
