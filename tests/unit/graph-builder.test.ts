import { describe, expect, it } from "vitest";

async function api() {
  return import("../../src/graph/graph-builder.js");
}

describe("Obsidian graph builder", () => {
  it("resolves relative, Vault, alias, embed, and property links and builds backlinks", async () => {
    const { buildGraph } = await api();
    const graph = buildGraph([
      {
        path: "01 โปรเจกต์/ภาพรวม.md",
        content: `---
id: project-main
aliases: [โครงการหลัก]
supersedes: "[[02 ความรู้/ข้อกำหนด-v1]]"
---
ดู [[../02 ความรู้/มติล่าสุด|มติ]] และ ![[../90 แหล่งข้อมูล/ผัง.png]]
`
      },
      { path: "02 ความรู้/ข้อกำหนด-v1.md", content: "# รุ่นหนึ่ง\n" },
      { path: "02 ความรู้/มติล่าสุด.md", content: "อ้างกลับ [[โครงการหลัก]]\n" },
      { path: "90 แหล่งข้อมูล/ผัง.png", content: "" }
    ]);

    expect(graph.nodes.map((node) => node.path)).toEqual([
      "01 โปรเจกต์/ภาพรวม.md",
      "02 ความรู้/ข้อกำหนด-v1.md",
      "02 ความรู้/มติล่าสุด.md",
      "90 แหล่งข้อมูล/ผัง.png"
    ]);
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: "01 โปรเจกต์/ภาพรวม.md", to: "02 ความรู้/ข้อกำหนด-v1.md", kind: "property", relation: "supersedes", unresolved: false }),
      expect.objectContaining({ from: "01 โปรเจกต์/ภาพรวม.md", to: "02 ความรู้/มติล่าสุด.md", kind: "wikilink", relation: "links_to", unresolved: false }),
      expect.objectContaining({ from: "01 โปรเจกต์/ภาพรวม.md", to: "90 แหล่งข้อมูล/ผัง.png", kind: "embed", relation: "embeds", unresolved: false }),
      expect.objectContaining({ from: "02 ความรู้/มติล่าสุด.md", to: "01 โปรเจกต์/ภาพรวม.md", kind: "wikilink", relation: "links_to", unresolved: false })
    ]));
    expect(graph.backlinks["01 โปรเจกต์/ภาพรวม.md"]).toEqual(["02 ความรู้/มติล่าสุด.md"]);
  });

  it("keeps ambiguous basenames and missing targets unresolved", async () => {
    const { buildGraph } = await api();
    const graph = buildGraph([
      { path: "A/สรุป.md", content: "" },
      { path: "B/สรุป.md", content: "" },
      { path: "ต้นทาง.md", content: "[[สรุป]] [[ไม่มีจริง]]" }
    ]);

    expect(graph.edges).toEqual([
      expect.objectContaining({ rawTarget: "สรุป", to: null, unresolved: true, resolution: "ambiguous" }),
      expect.objectContaining({ rawTarget: "ไม่มีจริง", to: null, unresolved: true, resolution: "missing" })
    ]);
  });

  it("rejects graph inputs beyond the safe note and edge limits", async () => {
    const { buildGraph } = await api();
    const tooManyNotes = Array.from({ length: 10_001 }, (_, index) => ({ path: `${index}.md`, content: "" }));

    expect(() => buildGraph(tooManyNotes)).toThrowError(expect.objectContaining({ code: "GRAPH_LIMIT_EXCEEDED" }));
  });
});
