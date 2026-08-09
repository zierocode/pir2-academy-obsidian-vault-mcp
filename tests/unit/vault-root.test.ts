import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type ApprovedVault = { root: string; realRoot: string };
type VaultRootApi = {
  resolveApprovedVault(configuredPath: string): Promise<ApprovedVault>;
};

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-vault-root-"));
  temporaryRoots.push(root);
  return realpathSync(root);
}

async function loadVaultRootApi(): Promise<VaultRootApi | undefined> {
  try {
    return (await import("../../src/vault/vault-root.js")) as VaultRootApi;
  } catch {
    return undefined;
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("resolveApprovedVault", () => {
  it("returns the configured and canonical roots for an existing vault", async () => {
    const root = temporaryRoot();
    const vault = resolve(root, "vault");
    mkdirSync(vault);
    const api = await loadVaultRootApi();

    expect(api).toBeDefined();
    await expect(api?.resolveApprovedVault(vault)).resolves.toEqual({ root: vault, realRoot: realpathSync.native(vault) });
  });

  it("rejects a configured vault root that resolves through a symlink", async () => {
    const root = temporaryRoot();
    const vault = resolve(root, "vault");
    const linkedVault = resolve(root, "linked-vault");
    mkdirSync(vault);
    writeFileSync(resolve(vault, "note.md"), "# note\n");
    symlinkSync(vault, linkedVault, "dir");
    const api = await loadVaultRootApi();

    expect(api).toBeDefined();
    await expect(api?.resolveApprovedVault(linkedVault)).rejects.toMatchObject({ code: "VAULT_NOT_READY" });
  });

  it("rejects a configured vault whose parent component is a symlink", async () => {
    const root = temporaryRoot();
    const realParent = resolve(root, "real-parent");
    const vault = resolve(realParent, "vault");
    const linkedParent = resolve(root, "linked-parent");
    const linkedVault = resolve(linkedParent, "vault");
    mkdirSync(vault, { recursive: true });
    symlinkSync(realParent, linkedParent, "dir");
    const api = await loadVaultRootApi();

    expect(api).toBeDefined();
    await expect(api?.resolveApprovedVault(linkedVault)).rejects.toMatchObject({ code: "VAULT_NOT_READY" });
  });

  it("fails closed when the configured vault is missing", async () => {
    const root = temporaryRoot();
    const api = await loadVaultRootApi();

    expect(api).toBeDefined();
    await expect(api?.resolveApprovedVault(resolve(root, "missing"))).rejects.toMatchObject({ code: "VAULT_NOT_READY" });
  });

  it("fails closed when the configured path is a file", async () => {
    const root = temporaryRoot();
    const file = resolve(root, "not-a-vault.md");
    writeFileSync(file, "# not a vault\n");
    const api = await loadVaultRootApi();

    expect(api).toBeDefined();
    await expect(api?.resolveApprovedVault(file)).rejects.toMatchObject({ code: "VAULT_NOT_READY" });
  });
});
