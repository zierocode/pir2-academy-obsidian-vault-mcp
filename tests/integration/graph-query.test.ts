import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { buildGraph } from "../../src/graph/graph-builder.js";
import { saveGraphIndex } from "../../src/graph/graph-store.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("search_obsidian_knowledge", () => {
  it("returns real graph discoveries after keyword seeding", async () => {
    const [{ resolveApprovedVault }, { createNoteWriter }, { createMcpServer }] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/vault/note-writer.js"),
      import("../../src/server.js")
    ]);
    const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-graph-query-"));
    roots.push(parent);
    const root = resolve(parent, "vault");
    mkdirSync(root);
    writeFileSync(resolve(root, "โจทย์โครงการ.md"), "โจทย์ Common Ground [[มติล่าสุด]]");
    writeFileSync(resolve(root, "มติล่าสุด.md"), "ยึดพื้นที่ 120 ตารางเมตร");
    const vault = await resolveApprovedVault(realpathSync(root));
    await saveGraphIndex(vault, buildGraph([
      { path: "โจทย์โครงการ.md", content: "โจทย์ Common Ground [[มติล่าสุด]]" },
      { path: "มติล่าสุด.md", content: "ยึดพื้นที่ 120 ตารางเมตร" }
    ]));
    const server = createMcpServer({ vault, writer: createNoteWriter({ vault }), runCli: async () => ({ stdout: "", stderr: "", exitCode: 0 }) });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "vitest", version: "1.0.0" });

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({ name: "search_obsidian_knowledge", arguments: { query: "Common Ground", max_depth: 1 } });

      expect(result.structuredContent).toMatchObject({
        ok: true,
        data: {
          direct_matches: [{ path: "โจทย์โครงการ.md", match_kind: "keyword" }],
          graph_discoveries: [{ path: "มติล่าสุด.md", match_kind: "outgoing_link", edge_direction: "outgoing", depth: 1 }]
        }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("explores outgoing links and backlinks from one note", async () => {
    const [{ resolveApprovedVault }, { createNoteWriter }, { createMcpServer }] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/vault/note-writer.js"),
      import("../../src/server.js")
    ]);
    const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-explore-tool-"));
    roots.push(parent);
    const root = resolve(parent, "vault");
    mkdirSync(root);
    const notes = [
      { path: "A.md", content: "[[B]]" },
      { path: "B.md", content: "" },
      { path: "C.md", content: "[[A]]" }
    ];
    for (const note of notes) writeFileSync(resolve(root, note.path), note.content);
    const vault = await resolveApprovedVault(realpathSync(root));
    await saveGraphIndex(vault, buildGraph(notes));
    const server = createMcpServer({ vault, writer: createNoteWriter({ vault }), runCli: async () => ({ stdout: "", stderr: "", exitCode: 0 }) });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "vitest", version: "1.0.0" });

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({ name: "explore_obsidian_graph", arguments: { path: "A.md", direction: "both", max_depth: 1 } });

      expect(result.structuredContent).toMatchObject({
        ok: true,
        data: {
          seed_paths: ["A.md"],
          discoveries: [
            { path: "B.md", edge_direction: "outgoing", depth: 1 },
            { path: "C.md", edge_direction: "backlink", depth: 1 }
          ]
        }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
