import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/graph/graph-builder.js";

describe("bounded Obsidian graph traversal", () => {
  it("expands outgoing links and backlinks with relation paths and cycle protection", async () => {
    const { traverseGraph } = await import("../../src/graph/traversal.js");
    const graph = buildGraph([
      { path: "A.md", content: "[[B]]" },
      { path: "B.md", content: "[[C]]" },
      { path: "C.md", content: "[[A]]" },
      { path: "D.md", content: "[[B]]" }
    ]);

    const result = traverseGraph(graph, ["A.md"], { direction: "both", maxDepth: 2, limit: 20 });

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "B.md", depth: 1, edgeDirection: "outgoing", relation: "links_to", viaPath: ["A.md", "B.md"] }),
      expect.objectContaining({ path: "C.md", depth: 1, edgeDirection: "backlink", relation: "links_to", viaPath: ["A.md", "C.md"] }),
      expect.objectContaining({ path: "D.md", depth: 2, edgeDirection: "backlink", viaPath: ["A.md", "B.md", "D.md"] })
    ]));
    expect(result.filter((item) => item.path === "A.md")).toHaveLength(0);
  });
});
