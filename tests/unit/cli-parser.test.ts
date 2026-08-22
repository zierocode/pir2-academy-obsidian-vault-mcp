import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type ApprovedVault = { root: string; realRoot: string };
type ParserApi = {
  resolveApprovedVault(configuredPath: string): Promise<ApprovedVault>;
  parseSearchOutput(output: string, vault: ApprovedVault): Promise<string[]>;
};

const temporaryRoots: string[] = [];

function createVault(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-cli-parser-"));
  temporaryRoots.push(root);
  const vault = resolve(root, "vault");
  mkdirSync(resolve(vault, "notes"), { recursive: true });
  writeFileSync(resolve(vault, "notes/one.md"), "# One\n");
  writeFileSync(resolve(vault, "notes/two.md"), "# Two\n");
  return realpathSync(vault);
}

async function loadApi(): Promise<ParserApi | undefined> {
  try {
    const [vaultRoot, parser] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/obsidian/cli-parser.js")
    ]);
    return { ...vaultRoot, ...parser } as ParserApi;
  } catch {
    return undefined;
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("parseSearchOutput", () => {
  it("parses JSON search output and filters paths outside the MCP boundary", async () => {
    const vault = createVault();
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    await expect(
      api?.parseSearchOutput(JSON.stringify(["notes/one.md", ".obsidian/config.md", "../escape.md", "notes/two.md"]), approved)
    ).resolves.toEqual(["notes/one.md", "notes/two.md"]);
  });

  it("fails closed when Obsidian returns malformed search JSON", async () => {
    const vault = createVault();
    const api = await loadApi();

    expect(api).toBeDefined();
    const approved = await api!.resolveApprovedVault(vault);
    await expect(api?.parseSearchOutput("not-json", approved)).rejects.toMatchObject({ code: "OBSIDIAN_CLI_ERROR" });
  });
});
