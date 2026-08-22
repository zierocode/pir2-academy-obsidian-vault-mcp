import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
function vault() {
  const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-knowledge-writer-"));
  roots.push(parent);
  const root = resolve(parent, "vault");
  mkdirSync(root);
  return { root, realRoot: realpathSync(root) };
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("atomic knowledge build transaction", () => {
  it("previews multiple note changes without mutating the Vault and applies after exact confirmation", async () => {
    const { createKnowledgeWriter } = await import("../../src/vault/knowledge-writer.js");
    const approved = vault();
    writeFileSync(resolve(approved.realRoot, "เดิม.md"), "ก่อน\n");
    const writer = createKnowledgeWriter({ vault: approved, previewId: () => "preview-1", receiptId: () => "receipt-1", now: () => 100 });

    const preview = await writer.previewBuild({
      mode: "refresh",
      notes: [
        { path: "เดิม.md", content: "หลัง [[ใหม่]]\n", mode: "replace" },
        { path: "ใหม่.md", content: "สร้างใหม่ [[เดิม]]\n", mode: "create" }
      ],
      managedLinks: []
    });

    expect(preview).toMatchObject({ previewId: "preview-1", mode: "refresh", fileCount: 2, edgeCount: 2 });
    expect(readFileSync(resolve(approved.realRoot, "เดิม.md"), "utf8")).toBe("ก่อน\n");
    expect(existsSync(resolve(approved.realRoot, "ใหม่.md"))).toBe(false);
    await expect(writer.applyBuild("preview-1", "โอเค")).rejects.toMatchObject({ code: "WRITE_NOT_CONFIRMED" });

    const receipt = await writer.applyBuild("preview-1", "ยืนยันบันทึก");
    expect(receipt).toMatchObject({ receiptId: "receipt-1", changedFiles: ["เดิม.md", "ใหม่.md"], graph: { nodes: 2, edges: 2, healthy: true } });
    expect(readFileSync(resolve(approved.realRoot, "เดิม.md"), "utf8")).toBe("หลัง [[ใหม่]]\n");
    expect(readFileSync(resolve(approved.realRoot, "ใหม่.md"), "utf8")).toBe("สร้างใหม่ [[เดิม]]\n");
    expect(existsSync(resolve(approved.realRoot, ".pir-acdm/graph-index.json"))).toBe(true);
    expect(existsSync(resolve(approved.realRoot, ".pir-acdm/source-registry.json"))).toBe(true);
  });

  it("aborts the whole transaction when any target changed after preview", async () => {
    const { createKnowledgeWriter } = await import("../../src/vault/knowledge-writer.js");
    const approved = vault();
    writeFileSync(resolve(approved.realRoot, "หนึ่ง.md"), "เดิมหนึ่ง\n");
    writeFileSync(resolve(approved.realRoot, "สอง.md"), "เดิมสอง\n");
    const writer = createKnowledgeWriter({ vault: approved, previewId: () => "preview-1" });
    await writer.previewBuild({
      mode: "refresh",
      notes: [
        { path: "หนึ่ง.md", content: "ใหม่หนึ่ง\n", mode: "replace" },
        { path: "สอง.md", content: "ใหม่สอง\n", mode: "replace" }
      ],
      managedLinks: []
    });
    writeFileSync(resolve(approved.realRoot, "สอง.md"), "แก้จาก Obsidian\n");

    await expect(writer.applyBuild("preview-1", "ยืนยันบันทึก")).rejects.toMatchObject({ code: "GRAPH_CONFLICT" });
    expect(readFileSync(resolve(approved.realRoot, "หนึ่ง.md"), "utf8")).toBe("เดิมหนึ่ง\n");
    expect(readFileSync(resolve(approved.realRoot, "สอง.md"), "utf8")).toBe("แก้จาก Obsidian\n");
  });

  it("restores already-written targets when a later atomic write fails", async () => {
    const { createKnowledgeWriter } = await import("../../src/vault/knowledge-writer.js");
    const approved = vault();
    writeFileSync(resolve(approved.realRoot, "หนึ่ง.md"), "เดิมหนึ่ง\n");
    writeFileSync(resolve(approved.realRoot, "สอง.md"), "เดิมสอง\n");
    let writes = 0;
    const writer = createKnowledgeWriter({
      vault: approved,
      previewId: () => "preview-1",
      atomicWrite: async (path, content) => {
        writes += 1;
        if (writes === 2) throw new Error("simulated second write failure");
        writeFileSync(path, content);
      }
    });
    await writer.previewBuild({
      mode: "refresh",
      notes: [
        { path: "หนึ่ง.md", content: "ใหม่หนึ่ง\n", mode: "replace" },
        { path: "สอง.md", content: "ใหม่สอง\n", mode: "replace" }
      ],
      managedLinks: []
    });

    await expect(writer.applyBuild("preview-1", "ยืนยันบันทึก")).rejects.toMatchObject({ code: "OBSIDIAN_CLI_ERROR" });
    expect(readFileSync(resolve(approved.realRoot, "หนึ่ง.md"), "utf8")).toBe("เดิมหนึ่ง\n");
    expect(readFileSync(resolve(approved.realRoot, "สอง.md"), "utf8")).toBe("เดิมสอง\n");
  });
});
