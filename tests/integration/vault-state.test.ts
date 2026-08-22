import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
function vault() {
  const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-vault-state-"));
  roots.push(parent);
  const root = resolve(parent, "vault");
  mkdirSync(root);
  return { root, realRoot: realpathSync(root) };
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Second Brain Vault state classifier", () => {
  it("distinguishes empty, uninitialized, clean, dirty, and broken graph states", async () => {
    const { classifyVaultState } = await import("../../src/vault/vault-state.js");
    const { createKnowledgeWriter } = await import("../../src/vault/knowledge-writer.js");
    const approved = vault();

    await expect(classifyVaultState(approved)).resolves.toMatchObject({ state: "empty", pendingChanges: 0 });
    writeFileSync(resolve(approved.realRoot, "ข้อมูล.md"), "ข้อมูลตั้งต้น");
    await expect(classifyVaultState(approved)).resolves.toMatchObject({ state: "uninitialized", pendingChanges: 1 });

    const writer = createKnowledgeWriter({ vault: approved, previewId: () => "p", receiptId: () => "r" });
    await writer.previewBuild({ mode: "initialize", notes: [{ path: "หน้าแรก.md", content: "[[ข้อมูล]]", mode: "create" }], managedLinks: [] });
    await writer.applyBuild("p", "ยืนยันบันทึก");
    await expect(classifyVaultState(approved)).resolves.toMatchObject({ state: "ready_clean", pendingChanges: 0 });

    writeFileSync(resolve(approved.realRoot, "เพิ่มภายนอก.txt"), "เพิ่มผ่าน Finder");
    await expect(classifyVaultState(approved)).resolves.toMatchObject({ state: "ready_dirty", pendingChanges: 1 });

    writeFileSync(resolve(approved.realRoot, ".pir-acdm/graph-index.json"), "broken");
    await expect(classifyVaultState(approved)).resolves.toMatchObject({ state: "broken_graph" });
  });
});
