import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/graph/graph-builder.js";

describe("hybrid graph search result", () => {
  it("keeps keyword seeds separate from graph discoveries and exposes provenance", async () => {
    const { searchGraph } = await import("../../src/graph/search.js");
    const graph = buildGraph([
      { path: "Project Brief.md", content: "[[Requirement v1]] [[Current Decision]]" },
      { path: "Requirement v1.md", content: "[[Feedback 1]]" },
      { path: "Feedback 1.md", content: "[[Feedback 2]]" },
      { path: "Feedback 2.md", content: "[[Feedback 3]]" },
      { path: "Feedback 3.md", content: "[[Current Decision]]" },
      { path: "Current Decision.md", content: "[[Feedback 3]]" }
    ]);

    const result = searchGraph(graph, ["Project Brief.md", "Current Decision.md"], { maxDepth: 2, limit: 20 });

    expect(result.directMatches).toEqual([
      { path: "Project Brief.md", matchKind: "keyword", depth: 0, viaPath: ["Project Brief.md"] },
      { path: "Current Decision.md", matchKind: "keyword", depth: 0, viaPath: ["Current Decision.md"] }
    ]);
    expect(result.graphDiscoveries).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "Requirement v1.md", matchKind: "outgoing_link", viaPath: ["Project Brief.md", "Requirement v1.md"] }),
      expect.objectContaining({ path: "Feedback 3.md", matchKind: "outgoing_link", viaPath: ["Current Decision.md", "Feedback 3.md"] }),
      expect.objectContaining({ path: "Feedback 2.md", matchKind: "backlink", depth: 2 })
    ]));
    expect(result.fallbackReason).toBeUndefined();
  });

  it("reports keyword fallback when no usable graph edge exists", async () => {
    const { searchGraph } = await import("../../src/graph/search.js");
    const graph = buildGraph([{ path: "โดดเดี่ยว.md", content: "ไม่มีลิงก์" }]);

    expect(searchGraph(graph, ["โดดเดี่ยว.md"], { maxDepth: 2, limit: 20 })).toMatchObject({
      graphDiscoveries: [],
      fallbackReason: "no_usable_edges"
    });
  });
});
