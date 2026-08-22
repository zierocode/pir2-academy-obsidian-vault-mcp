import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/graph/graph-builder.js";

describe("Obsidian graph audit", () => {
  it("reports unresolved links, orphan notes, and duplicate identities", async () => {
    const { auditGraph } = await import("../../src/graph/audit.js");
    const graph = buildGraph([
      { path: "A.md", content: "---\nid: same\n---\n[[ไม่มีจริง]]" },
      { path: "B.md", content: "---\nid: same\n---\n" },
      { path: "C.md", content: "" }
    ]);

    const result = auditGraph(graph);

    expect(result.healthy).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "UNRESOLVED_LINK", path: "A.md" }),
      expect.objectContaining({ code: "DUPLICATE_ID", path: "B.md" }),
      expect.objectContaining({ code: "ORPHAN_NOTE", path: "C.md" })
    ]));
  });

  it("does not treat the conventional root README as an orphan knowledge note", async () => {
    const { auditGraph } = await import("../../src/graph/audit.js");
    const graph = buildGraph([
      { path: "README.md", content: "# วิธีใช้ Vault" },
      { path: "โครงการ.md", content: "[[ข้อมูลลูกค้า]]" },
      { path: "ข้อมูลลูกค้า.md", content: "[[โครงการ]]" }
    ]);

    const result = auditGraph(graph);

    expect(result.healthy).toBe(true);
    expect(result.issues).not.toContainEqual(expect.objectContaining({ path: "README.md" }));
  });
});
