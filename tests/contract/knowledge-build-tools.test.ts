import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("knowledge build MCP tools", () => {
  it("keeps preview read-only and applies the same plan after exact confirmation", async () => {
    const [{ resolveApprovedVault }, { createNoteWriter }, { createMcpServer }] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/vault/note-writer.js"),
      import("../../src/server.js")
    ]);
    const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-build-tools-"));
    roots.push(parent);
    const root = resolve(parent, "vault");
    mkdirSync(root);
    const vault = await resolveApprovedVault(realpathSync(root));
    const server = createMcpServer({ vault, writer: createNoteWriter({ vault }), runCli: async () => ({ stdout: "", stderr: "", exitCode: 0 }) });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "vitest", version: "1.0.0" });

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const preview = await client.callTool({
        name: "preview_obsidian_knowledge_build",
        arguments: {
          mode: "initialize",
          notes: [
            { path: "หน้าแรก.md", content: "[[ความรู้]]", mode: "create" },
            { path: "ความรู้.md", content: "[[หน้าแรก]]", mode: "create" }
          ],
          managed_links: []
        }
      });
      const previewData = preview.structuredContent as { data?: { preview_id?: string } };
      expect(previewData).toMatchObject({ data: { preview_id: expect.any(String), summary: { files: 2, edges: 2 } } });
      expect(existsSync(resolve(root, "หน้าแรก.md"))).toBe(false);

      const denied = await client.callTool({
        name: "apply_obsidian_knowledge_build",
        arguments: { preview_id: previewData.data!.preview_id, confirmation: "ยกเลิก" }
      });
      expect(denied).toMatchObject({ isError: true, structuredContent: { code: "WRITE_NOT_CONFIRMED" } });
      expect(existsSync(resolve(root, "หน้าแรก.md"))).toBe(false);

      const applied = await client.callTool({
        name: "apply_obsidian_knowledge_build",
        arguments: { preview_id: previewData.data!.preview_id, confirmation: "ยืนยันบันทึก" }
      });
      expect(applied.structuredContent).toMatchObject({
        ok: true,
        data: { changed_files: ["หน้าแรก.md", "ความรู้.md"], graph: { nodes: 2, edges: 2, healthy: true } }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
