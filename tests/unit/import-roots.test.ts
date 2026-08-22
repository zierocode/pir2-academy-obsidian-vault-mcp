import { mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveApprovedVault } from "../../src/vault/vault-root.js";
import { resolveImportSource } from "../../src/source/import-roots.js";
import { rm } from "node:fs/promises";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "pir-acdm-import-roots-"));
  roots.push(root);
  const vaultPath = resolve(root, "vault");
  const importPath = resolve(root, "cowork");
  await mkdir(vaultPath);
  await mkdir(importPath);
  const vault = await resolveApprovedVault(await realpath(vaultPath));
  return { root, vault, importPath };
}

describe("source import root boundary", () => {
  it("allows a regular file in the Vault or an active Cowork root", async () => {
    const { vault, importPath } = await fixture();
    const external = resolve(importPath, "โจทย์.txt");
    const local = resolve(vault.realRoot, "ข้อมูล.txt");
    await writeFile(external, "external");
    await writeFile(local, "local");
    await expect(resolveImportSource(external, [importPath], vault)).resolves.toMatchObject({ origin: "external", displayPath: "โจทย์.txt" });
    await expect(resolveImportSource(local, [], vault)).resolves.toMatchObject({ origin: "vault", displayPath: "ข้อมูล.txt" });
  });

  it("rejects files outside all active roots", async () => {
    const { root, vault, importPath } = await fixture();
    const outside = resolve(root, "outside.txt");
    await writeFile(outside, "outside");
    await expect(resolveImportSource(outside, [importPath], vault)).rejects.toMatchObject({ code: "SOURCE_NOT_ACCESSIBLE" });
  });

  it("rejects symlink escapes", async () => {
    const { root, vault, importPath } = await fixture();
    const outside = resolve(root, "outside.txt");
    const link = resolve(importPath, "link.txt");
    await writeFile(outside, "outside");
    await symlink(outside, link);
    await expect(resolveImportSource(link, [importPath], vault)).rejects.toMatchObject({ code: "SOURCE_NOT_ACCESSIBLE" });
  });
});
