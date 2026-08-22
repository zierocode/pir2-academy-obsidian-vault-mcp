import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSourceInspector } from "../../src/source/source-inspector.js";
import { createSourceIntakeWriter } from "../../src/vault/source-intake-writer.js";
import { resolveApprovedVault } from "../../src/vault/vault-root.js";
import { rollbackKnowledgeChange } from "../../src/vault/rollback.js";

const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

describe("Cowork-native source intake", () => {
  it("copies the original, registers Cowork-authored knowledge, builds the graph, and rolls back", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "pir-acdm-source-intake-"));
    temporary.push(root);
    const vaultPath = resolve(root, "vault");
    const coworkPath = resolve(root, "cowork");
    await mkdir(vaultPath);
    await mkdir(coworkPath);
    const sourcePath = resolve(coworkPath, "โจทย์ลูกค้า.txt");
    await writeFile(sourcePath, "ต้องเปิดสาขาใหม่ภายในเดือนตุลาคม", "utf8");
    const vault = await resolveApprovedVault(await realpath(vaultPath));
    const inspector = createSourceInspector(vault);
    const [source] = await inspector.inspect([sourcePath], [coworkPath]);
    const writer = createSourceIntakeWriter({ vault, inspector });

    const preview = await writer.preview({
      sources: [{ sourceId: source!.sourceId, destination: "90 แหล่งข้อมูล/โจทย์ลูกค้า.txt", project: "โครงการสาขาใหม่" }],
      notes: [{
        path: "20 โครงการ/โครงการสาขาใหม่/ภาพรวม.md",
        mode: "create",
        content: "---\nsources:\n  - '[[90 แหล่งข้อมูล/โจทย์ลูกค้า.txt]]'\n---\n# โครงการสาขาใหม่\n\nที่มา [[90 แหล่งข้อมูล/โจทย์ลูกค้า.txt]]\n"
      }],
      managedLinks: []
    });
    await expect(stat(resolve(vaultPath, "90 แหล่งข้อมูล/โจทย์ลูกค้า.txt"))).rejects.toMatchObject({ code: "ENOENT" });

    const receipt = await writer.apply(preview.id, "ยืนยันนำเข้า");
    expect(receipt.copiedSources).toEqual(["90 แหล่งข้อมูล/โจทย์ลูกค้า.txt"]);
    expect(receipt.graph).toMatchObject({ nodes: 2, healthy: true });
    expect(await readFile(resolve(vaultPath, "90 แหล่งข้อมูล/โจทย์ลูกค้า.txt"), "utf8")).toContain("เดือนตุลาคม");
    expect(await readFile(resolve(vaultPath, "20 โครงการ/โครงการสาขาใหม่/ภาพรวม.md"), "utf8")).toContain("โจทย์ลูกค้า.txt");
    const registry = JSON.parse(await readFile(resolve(vaultPath, ".pir-acdm/source-registry.json"), "utf8"));
    expect(registry.records.find((record: { path: string }) => record.path === "90 แหล่งข้อมูล/โจทย์ลูกค้า.txt")).toMatchObject({
      projectLinks: ["โครงการสาขาใหม่"],
      generatedNoteLinks: ["20 โครงการ/โครงการสาขาใหม่/ภาพรวม.md"]
    });

    await rollbackKnowledgeChange(vault, receipt.receiptId, "ยืนยันบันทึก");
    await expect(stat(resolve(vaultPath, "90 แหล่งข้อมูล/โจทย์ลูกค้า.txt"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(resolve(vaultPath, "20 โครงการ/โครงการสาขาใหม่/ภาพรวม.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
