import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const SCRIPT = resolve(ROOT, "scripts/scan-secrets.mjs");
const temporaryRoots: string[] = [];

function fixtureRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-secret-scan-"));
  temporaryRoots.push(root);
  return root;
}

function scan(root: string) {
  return spawnSync(process.execPath, [SCRIPT, "--root", root], {
    cwd: ROOT,
    encoding: "utf8"
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("secret scan script", () => {
  it("accepts a clean local source fixture", () => {
    const root = fixtureRoot();
    mkdirSync(resolve(root, "src"));
    writeFileSync(resolve(root, "src/note.ts"), "export const message = 'ปลอดภัย';\n");

    const result = scan(root);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("secret scan passed");
  });

  it("fails closed when a credential-shaped value is present", () => {
    const root = fixtureRoot();
    const syntheticKey = ["sk", "live", "not-a-real-key-1234567890"].join("-");
    writeFileSync(resolve(root, "config.txt"), `token=${syntheticKey}\n`);

    const result = scan(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("secret-like value");
  });
});
