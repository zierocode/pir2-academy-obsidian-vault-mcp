import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
function vault() {
  const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-scanner-"));
  roots.push(parent);
  const root = resolve(parent, "vault");
  mkdirSync(root);
  return { root, realRoot: realpathSync(root) };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("incremental Vault change scanner", () => {
  it("reports new files and ignores runtime, Obsidian, Git, temp, and Office owner files", async () => {
    const { scanVaultChanges } = await import("../../src/vault/change-scanner.js");
    const approved = vault();
    mkdirSync(resolve(approved.realRoot, "90 แหล่งข้อมูล"));
    mkdirSync(resolve(approved.realRoot, ".obsidian"));
    mkdirSync(resolve(approved.realRoot, ".pir-acdm"));
    mkdirSync(resolve(approved.realRoot, ".git"));
    writeFileSync(resolve(approved.realRoot, "90 แหล่งข้อมูล/โจทย์.txt"), "โจทย์ลูกค้า");
    writeFileSync(resolve(approved.realRoot, "90 แหล่งข้อมูล/~$โจทย์.docx"), "owner");
    writeFileSync(resolve(approved.realRoot, "draft.tmp"), "temp");
    writeFileSync(resolve(approved.realRoot, ".obsidian/workspace.json"), "{}");
    writeFileSync(resolve(approved.realRoot, ".pir-acdm/source-registry.json"), "{}");
    writeFileSync(resolve(approved.realRoot, ".git/index"), "git");

    const result = await scanVaultChanges(approved, { schemaVersion: 1, records: [] }, () => 100);

    expect(result.changes).toEqual([expect.objectContaining({ kind: "new", path: "90 แหล่งข้อมูล/โจทย์.txt" })]);
    expect(result.nextRegistry.records).toHaveLength(1);
  });

  it("preserves identity across changed, moved, duplicate, and missing files", async () => {
    const { scanVaultChanges } = await import("../../src/vault/change-scanner.js");
    const approved = vault();
    writeFileSync(resolve(approved.realRoot, "ต้นฉบับ.txt"), "รุ่นหนึ่ง");
    const first = await scanVaultChanges(approved, { schemaVersion: 1, records: [] }, () => 100);
    const id = first.nextRegistry.records[0]!.id;

    writeFileSync(resolve(approved.realRoot, "ต้นฉบับ.txt"), "รุ่นสอง");
    const changed = await scanVaultChanges(approved, first.nextRegistry, () => 200);
    expect(changed.changes).toEqual([expect.objectContaining({ kind: "changed", id, revisionParentHash: first.nextRegistry.records[0]!.sha256 })]);

    renameSync(resolve(approved.realRoot, "ต้นฉบับ.txt"), resolve(approved.realRoot, "เปลี่ยนชื่อ.txt"));
    const moved = await scanVaultChanges(approved, changed.nextRegistry, () => 300);
    expect(moved.changes).toEqual([expect.objectContaining({ kind: "moved", id, previousPath: "ต้นฉบับ.txt", path: "เปลี่ยนชื่อ.txt" })]);

    writeFileSync(resolve(approved.realRoot, "สำเนา.txt"), "รุ่นสอง");
    const duplicate = await scanVaultChanges(approved, moved.nextRegistry, () => 400);
    expect(duplicate.changes).toEqual([expect.objectContaining({ kind: "duplicate", duplicateOf: id, path: "สำเนา.txt" })]);

    unlinkSync(resolve(approved.realRoot, "เปลี่ยนชื่อ.txt"));
    unlinkSync(resolve(approved.realRoot, "สำเนา.txt"));
    const missing = await scanVaultChanges(approved, duplicate.nextRegistry, () => 500);
    expect(missing.changes).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "missing", id })]));
  });

  it("classifies an edited managed note as manual_edit", async () => {
    const { scanVaultChanges } = await import("../../src/vault/change-scanner.js");
    const approved = vault();
    writeFileSync(resolve(approved.realRoot, "สรุป.md"), "สร้างโดยระบบ");
    const first = await scanVaultChanges(approved, { schemaVersion: 1, records: [] }, () => 100);
    first.nextRegistry.records[0]!.role = "generated";
    writeFileSync(resolve(approved.realRoot, "สรุป.md"), "ผู้เรียนแก้เอง");

    const result = await scanVaultChanges(approved, first.nextRegistry, () => 200);

    expect(result.changes).toEqual([expect.objectContaining({ kind: "manual_edit", path: "สรุป.md" })]);
  });
});
