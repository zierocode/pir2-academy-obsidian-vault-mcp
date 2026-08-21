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
});
