import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("filesystem-direct MCP runtime", () => {
  it("runs core status, search, read and linked-context with no Obsidian process or CLI service", async () => {
    const root = mkdtempSync(resolve(tmpdir(), "pir2-no-obsidian-runtime-"));
    temporaryRoots.push(root);
    const vaultPath = resolve(root, "คลัง ความรู้");
    mkdirSync(resolve(vaultPath, "โครงการ"), { recursive: true });
    writeFileSync(resolve(vaultPath, "หน้าหลัก.md"), "# หน้าหลัก\nดู [[โครงการ/ข้อสรุปล่าสุด]]\n");
    writeFileSync(resolve(vaultPath, "โครงการ", "ข้อสรุปล่าสุด.md"), "# ข้อสรุปล่าสุด\nงบประมาณที่อนุมัติ 500,000 บาท\nดู [[หลักฐาน]]\n");
    writeFileSync(resolve(vaultPath, "โครงการ", "หลักฐาน.md"), "# หลักฐาน\nอนุมัติเมื่อ 20 สิงหาคม 2569\n");

    const [{ resolveApprovedVault }, { createNoteWriter }, { createMcpServer }] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/vault/note-writer.js"),
      import("../../src/server.js")
    ]);
    const vault = await resolveApprovedVault(realpathSync(vaultPath));
    const server = createMcpServer({ vault, writer: createNoteWriter({ vault }), openViewer: async () => undefined });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "vitest", version: "1.0.0" });

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const status = await client.callTool({ name: "obsidian_vault_status", arguments: {} });
      const search = await client.callTool({ name: "search_obsidian_notes", arguments: { query: "งบประมาณ" } });
      const read = await client.callTool({ name: "read_obsidian_notes", arguments: { paths: ["หน้าหลัก.md"] } });
      const linkedDepthOne = await client.callTool({
        name: "get_obsidian_linked_context",
        arguments: { path: "หน้าหลัก.md", max_depth: 1 }
      });
      const linkedDepthTwo = await client.callTool({
        name: "get_obsidian_linked_context",
        arguments: { path: "หน้าหลัก.md", max_depth: 2 }
      });

      expect(status.structuredContent).toMatchObject({ ok: true, data: { ready: true, note_count: 3 } });
      expect(search.structuredContent).toMatchObject({
        ok: true,
        data: { paths: ["โครงการ/ข้อสรุปล่าสุด.md"], content_is_untrusted_data: true }
      });
      expect(read.structuredContent).toMatchObject({ ok: true, data: { count: 1 } });
      expect(linkedDepthOne.structuredContent).toMatchObject({
        ok: true,
        data: {
          outgoing: [{ target: "โครงการ/ข้อสรุปล่าสุด", resolved_path: "โครงการ/ข้อสรุปล่าสุด.md" }],
          related_notes: [{ path: "โครงการ/ข้อสรุปล่าสุด.md" }]
        }
      });
      expect(linkedDepthTwo.structuredContent).toMatchObject({
        ok: true,
        data: {
          related_notes: [
            { path: "โครงการ/ข้อสรุปล่าสุด.md" },
            { path: "โครงการ/หลักฐาน.md" }
          ],
          graph_edges: [
            { source_path: "หน้าหลัก.md", target_path: "โครงการ/ข้อสรุปล่าสุด.md" },
            { source_path: "โครงการ/ข้อสรุปล่าสุด.md", target_path: "โครงการ/หลักฐาน.md" }
          ]
        }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
