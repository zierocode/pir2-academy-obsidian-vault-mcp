import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];

async function api() {
  const [rootModule, searchModule, pathModule] = await Promise.all([
    import("../../src/vault/vault-root.js"),
    import("../../src/vault/note-search.js"),
    import("../../src/vault/note-path.js")
  ]);
  return { ...rootModule, ...searchModule, ...pathModule };
}

function fixture(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-note-search-"));
  temporaryRoots.push(root);
  const vault = resolve(root, "vault");
  mkdirSync(resolve(vault, "02 โปรเจกต์", "คอมมอนกราวด์"), { recursive: true });
  mkdirSync(resolve(vault, ".obsidian"));
  mkdirSync(resolve(vault, ".pir2-academy-backups"));
  writeFileSync(resolve(vault, "02 โปรเจกต์", "คอมมอนกราวด์", "ข้อมูลล่าสุดที่ต้องยึด.md"), "ฟีดแบ็กรอบ 3 ยืนยันขอบเขตเปิดสาขา\n");
  writeFileSync(resolve(vault, ".obsidian", "private.md"), "ฟีดแบ็กรอบ 3\n");
  writeFileSync(resolve(vault, ".pir2-academy-backups", "old.md"), "ฟีดแบ็กรอบ 3\n");
  return realpathSync(vault);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("direct filesystem note search", () => {
  it("finds Markdown content without Obsidian or CLI and excludes protected folders", async () => {
    const loaded = await api();
    const vault = await loaded.resolveApprovedVault(fixture());
    await expect(loaded.searchMarkdownNotes(vault, "ฟีดแบ็กรอบ 3", undefined, 20)).resolves.toEqual([
      "02 โปรเจกต์/คอมมอนกราวด์/ข้อมูลล่าสุดที่ต้องยึด.md"
    ]);
  });

  it("skips symlink directories and accepts Windows-style relative folder input after normalization", async () => {
    const loaded = await api();
    const vaultPath = fixture();
    const outside = resolve(vaultPath, "..", "outside");
    mkdirSync(outside);
    writeFileSync(resolve(outside, "escape.md"), "ฟีดแบ็กรอบ 3\n");
    symlinkSync(outside, resolve(vaultPath, "linked"), "dir");
    const vault = await loaded.resolveApprovedVault(vaultPath);
    const windowsFolder = loaded.normalizeVaultFolderPath("02 โปรเจกต์\\คอมมอนกราวด์");
    await expect(loaded.searchMarkdownNotes(vault, "เปิดสาขา", windowsFolder, 20)).resolves.toEqual([
      "02 โปรเจกต์/คอมมอนกราวด์/ข้อมูลล่าสุดที่ต้องยึด.md"
    ]);
    await expect(loaded.searchMarkdownNotes(vault, "ฟีดแบ็กรอบ 3", undefined, 20)).resolves.not.toContain("linked/escape.md");
  });
});
