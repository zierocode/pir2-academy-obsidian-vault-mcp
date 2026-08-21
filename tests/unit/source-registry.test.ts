import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
function vault() {
  const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-registry-"));
  roots.push(parent);
  const root = resolve(parent, "vault");
  mkdirSync(root);
  return { root, realRoot: realpathSync(root) };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("source registry persistence", () => {
  it("round-trips rebuildable relative metadata without leaking the Vault root", async () => {
    const { saveSourceRegistry, readSourceRegistry } = await import("../../src/vault/source-registry.js");
    const approved = vault();
    const registry = {
      schemaVersion: 1 as const,
      records: [{
        id: "src-1",
        path: "90 แหล่งข้อมูล/โจทย์.pdf",
        type: ".pdf",
        role: "source" as const,
        size: 10,
        modifiedTime: 100,
        sha256: "a".repeat(64),
        firstImported: 100,
        lastSeen: 100,
        projectLinks: ["โครงการหลัก"],
        generatedNoteLinks: ["02 ความรู้/โจทย์.md"]
      }]
    };

    await saveSourceRegistry(approved, registry);
    await expect(readSourceRegistry(approved)).resolves.toEqual(registry);
    expect(readFileSync(resolve(approved.realRoot, ".pir-acdm/source-registry.json"), "utf8")).not.toContain(approved.realRoot);
  });
});
