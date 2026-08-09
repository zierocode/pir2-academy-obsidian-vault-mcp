import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type ApprovedVault = { root: string; realRoot: string };
type ResolvedNotePath = { absolutePath: string; relativePath: string };
type VaultApi = {
  resolveApprovedVault(configuredPath: string): Promise<ApprovedVault>;
  resolveNotePath(vault: ApprovedVault, notePath: string): Promise<ResolvedNotePath>;
};

const temporaryRoots: string[] = [];

function temporaryVault(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-note-path-"));
  temporaryRoots.push(root);
  const vault = resolve(root, "vault");
  mkdirSync(vault);
  return vault;
}

async function loadVaultApi(): Promise<VaultApi | undefined> {
  try {
    const [rootModule, pathModule] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/vault/note-path.js")
    ]);
    return { ...rootModule, ...pathModule } as VaultApi;
  } catch {
    return undefined;
  }
}

async function approvedVault(api: VaultApi, vault: string): Promise<ApprovedVault> {
  return api.resolveApprovedVault(vault);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("resolveNotePath", () => {
  it("accepts a nested Markdown path inside the canonical vault", async () => {
    const vault = temporaryVault();
    const api = await loadVaultApi();

    expect(api).toBeDefined();
    const approved = await approvedVault(api!, vault);
    await expect(api?.resolveNotePath(approved, "01 Meetings/weekly.md")).resolves.toEqual({
      absolutePath: resolve(realpathSync(vault), "01 Meetings/weekly.md"),
      relativePath: "01 Meetings/weekly.md"
    });
  });

  it.each(["/tmp/escape.md", "C:\\\\temp\\\\escape.md", "\\\\server\\\\share\\\\escape.md"])(
    "rejects an absolute note path: %s",
    async (notePath) => {
      const vault = temporaryVault();
      const api = await loadVaultApi();

      expect(api).toBeDefined();
      const approved = await approvedVault(api!, vault);
      await expect(api?.resolveNotePath(approved, notePath)).rejects.toMatchObject({ code: "INVALID_NOTE_PATH" });
    }
  );

  it.each(["../escape.md", "notes/../../escape.md"])("rejects traversal: %s", async (notePath) => {
    const vault = temporaryVault();
    const api = await loadVaultApi();

    expect(api).toBeDefined();
    const approved = await approvedVault(api!, vault);
    await expect(api?.resolveNotePath(approved, notePath)).rejects.toMatchObject({ code: "INVALID_NOTE_PATH" });
  });

  it.each([".obsidian/app.md", ".pir2-academy-backups/old.md"])("rejects a protected directory: %s", async (notePath) => {
    const vault = temporaryVault();
    const api = await loadVaultApi();

    expect(api).toBeDefined();
    const approved = await approvedVault(api!, vault);
    await expect(api?.resolveNotePath(approved, notePath)).rejects.toMatchObject({ code: "INVALID_NOTE_PATH" });
  });

  it("rejects a non-Markdown target", async () => {
    const vault = temporaryVault();
    const api = await loadVaultApi();

    expect(api).toBeDefined();
    const approved = await approvedVault(api!, vault);
    await expect(api?.resolveNotePath(approved, "notes/unsafe.txt")).rejects.toMatchObject({ code: "INVALID_NOTE_PATH" });
  });

  it("rejects a symlink file inside the vault", async () => {
    const vault = temporaryVault();
    const outside = resolve(vault, "..", "outside.md");
    const linkedFile = resolve(vault, "linked.md");
    writeFileSync(outside, "# outside\n");
    symlinkSync(outside, linkedFile, "file");
    const api = await loadVaultApi();

    expect(api).toBeDefined();
    const approved = await approvedVault(api!, vault);
    await expect(api?.resolveNotePath(approved, "linked.md")).rejects.toMatchObject({ code: "INVALID_NOTE_PATH" });
  });

  it("rejects a path through a symlink directory inside the vault", async () => {
    const vault = temporaryVault();
    const outside = resolve(vault, "..", "outside");
    const linkedDirectory = resolve(vault, "linked");
    mkdirSync(outside);
    writeFileSync(resolve(outside, "note.md"), "# outside\n");
    symlinkSync(outside, linkedDirectory, "dir");
    const api = await loadVaultApi();

    expect(api).toBeDefined();
    const approved = await approvedVault(api!, vault);
    await expect(api?.resolveNotePath(approved, "linked/note.md")).rejects.toMatchObject({ code: "INVALID_NOTE_PATH" });
  });
});
