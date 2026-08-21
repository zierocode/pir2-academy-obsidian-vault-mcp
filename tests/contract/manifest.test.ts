import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const PACKAGE_PATH = resolve(ROOT, "package.json");
const MANIFEST_PATH = resolve(ROOT, "manifest.json");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("MCPB manifest contract", () => {
  it("declares the exact PiR-ACDM package identity", () => {
    expect(existsSync(PACKAGE_PATH)).toBe(true);
    expect(existsSync(MANIFEST_PATH)).toBe(true);

    const packageJson = readJson(PACKAGE_PATH);
    const manifest = readJson(MANIFEST_PATH);

    expect(packageJson).toMatchObject({
      name: "pir-acdm-obsidian-vault",
      version: "0.4.0",
      engines: { node: ">=20" }
    });
    expect(manifest).toMatchObject({
      manifest_version: "0.4",
      name: "pir-acdm-obsidian-vault",
      display_name: "PiR-ACDM — Obsidian Second Brain MCP",
      version: "0.4.0"
    });
  });

  it("declares only macOS and Windows Node 20 support", () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);

    const manifest = readJson(MANIFEST_PATH);
    expect(manifest.compatibility).toEqual({
      platforms: ["darwin", "win32"],
      runtimes: { node: ">=20" }
    });
  });

  it("requires one approved vault directory with Thai-first help", () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);

    const manifest = readJson(MANIFEST_PATH);
    expect(manifest.user_config).toEqual({
      vault_root: {
        type: "directory",
        title: "Obsidian Vault root (เลือก 1 โฟลเดอร์)",
        description: "กด Browse แล้วเลือกโฟลเดอร์หลักของ Vault ที่ต้องการให้ MCP อ่านและเขียน",
        required: true,
        multiple: false
      }
    });
  });
});
