import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const SERVER_PATH = resolve(ROOT, "server/index.js");
const TSC_PATH = resolve(ROOT, "node_modules/typescript/bin/tsc");
const temporaryRoots: string[] = [];

function createVault(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-startup-"));
  temporaryRoots.push(root);
  const vault = resolve(root, "vault");
  mkdirSync(vault);
  return vault;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("MCP startup smoke", () => {
  it("starts a stdio-only server and closes cleanly when stdin closes", () => {
    execFileSync(process.execPath, [TSC_PATH, "--project", "tsconfig.json"], { cwd: ROOT, stdio: "pipe" });
    expect(existsSync(SERVER_PATH)).toBe(true);
    const vault = createVault();
    const result = spawnSync(process.execPath, [SERVER_PATH], {
      cwd: ROOT,
      env: { ...process.env, APPROVED_VAULT_ROOT: vault },
      input: "",
      encoding: "utf8",
      timeout: 5_000
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain(vault);
  });

  it("runs the repository smoke command through MCP initialize and tools/list", () => {
    const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "smoke"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 30_000
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("smoke=pass tools=6");
  });
});
