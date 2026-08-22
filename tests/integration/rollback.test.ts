import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
function vault() {
  const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-rollback-"));
  roots.push(parent);
  const root = resolve(parent, "vault");
  mkdirSync(root);
  return { root, realRoot: realpathSync(root) };
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("knowledge transaction rollback", () => {
  it("restores replaced notes and removes only files created by the known receipt", async () => {
    const { createKnowledgeWriter } = await import("../../src/vault/knowledge-writer.js");
    const { rollbackKnowledgeChange } = await import("../../src/vault/rollback.js");
    const approved = vault();
    writeFileSync(resolve(approved.realRoot, "เดิม.md"), "ก่อน\n");
    const writer = createKnowledgeWriter({ vault: approved, previewId: () => "preview-1", receiptId: () => "receipt-1" });
    await writer.previewBuild({
      mode: "refresh",
      notes: [
        { path: "เดิม.md", content: "หลัง\n", mode: "replace" },
        { path: "ใหม่.md", content: "ใหม่\n", mode: "create" }
      ],
      managedLinks: []
    });
    await writer.applyBuild("preview-1", "ยืนยันบันทึก");

    const receipt = await rollbackKnowledgeChange(approved, "receipt-1", "ยืนยันบันทึก");

    expect(receipt).toMatchObject({ rolledBackReceiptId: "receipt-1", restoredFiles: ["เดิม.md"], removedCreatedFiles: ["ใหม่.md"] });
    expect(readFileSync(resolve(approved.realRoot, "เดิม.md"), "utf8")).toBe("ก่อน\n");
    expect(() => readFileSync(resolve(approved.realRoot, "ใหม่.md"), "utf8")).toThrow();
  });

  it("refuses rollback when a learner edited any target after apply", async () => {
    const { createKnowledgeWriter } = await import("../../src/vault/knowledge-writer.js");
    const { rollbackKnowledgeChange } = await import("../../src/vault/rollback.js");
    const approved = vault();
    writeFileSync(resolve(approved.realRoot, "เดิม.md"), "ก่อน\n");
    const writer = createKnowledgeWriter({ vault: approved, previewId: () => "preview-1", receiptId: () => "receipt-1" });
    await writer.previewBuild({ mode: "refresh", notes: [{ path: "เดิม.md", content: "หลัง\n", mode: "replace" }], managedLinks: [] });
    await writer.applyBuild("preview-1", "ยืนยันบันทึก");
    writeFileSync(resolve(approved.realRoot, "เดิม.md"), "ผู้เรียนแก้ต่อ\n");

    await expect(rollbackKnowledgeChange(approved, "receipt-1", "ยืนยันบันทึก")).rejects.toMatchObject({ code: "ROLLBACK_CONFLICT" });
    expect(readFileSync(resolve(approved.realRoot, "เดิม.md"), "utf8")).toBe("ผู้เรียนแก้ต่อ\n");
  });
});
