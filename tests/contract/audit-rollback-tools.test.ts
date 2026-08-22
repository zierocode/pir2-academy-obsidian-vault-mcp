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

describe("graph audit and rollback MCP tools", () => {
  it("returns graph health issues from the persisted index", async () => {
    const harness = await createHarness();
    writeFileSync(resolve(harness.root, "A.md"), "[[หาย]]");
    await saveGraphIndex(harness.vault, buildGraph([{ path: "A.md", content: "[[หาย]]" }]));
    try {
      const result = await harness.client.callTool({ name: "audit_obsidian_graph", arguments: { mode: "full" } });
      expect(result.structuredContent).toMatchObject({ ok: true, data: { healthy: false } });
      expect((result.structuredContent as { data: { issues: unknown[] } }).data.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "UNRESOLVED_LINK", path: "A.md" })
      ]));
    } finally {
      await harness.close();
    }
  });

  it("rolls back a known build receipt after exact confirmation", async () => {
    const harness = await createHarness();
    writeFileSync(resolve(harness.root, "เดิม.md"), "ก่อน\n");
    try {
      const preview = await harness.client.callTool({
        name: "preview_obsidian_knowledge_build",
        arguments: { mode: "refresh", notes: [{ path: "เดิม.md", content: "หลัง\n", mode: "replace" }], managed_links: [] }
      });
      const previewId = (preview.structuredContent as { data: { preview_id: string } }).data.preview_id;
      const applied = await harness.client.callTool({ name: "apply_obsidian_knowledge_build", arguments: { preview_id: previewId, confirmation: "ยืนยันบันทึก" } });
      const receiptId = (applied.structuredContent as { data: { receipt_id: string } }).data.receipt_id;
      const rolledBack = await harness.client.callTool({ name: "rollback_obsidian_change", arguments: { receipt_id: receiptId, confirmation: "ยืนยันบันทึก" } });
      expect(rolledBack.structuredContent).toMatchObject({ ok: true, data: { rolled_back_receipt_id: receiptId, restored_files: ["เดิม.md"] } });
    } finally {
      await harness.close();
    }
  });
});

async function createHarness() {
  const [{ resolveApprovedVault }, { createNoteWriter }, { createMcpServer }] = await Promise.all([
    import("../../src/vault/vault-root.js"),
    import("../../src/vault/note-writer.js"),
    import("../../src/server.js")
  ]);
  const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-audit-tools-"));
  roots.push(parent);
  const root = resolve(parent, "vault");
  mkdirSync(root);
  const vault = await resolveApprovedVault(realpathSync(root));
  const server = createMcpServer({ vault, writer: createNoteWriter({ vault }), runCli: async () => ({ stdout: "", stderr: "", exitCode: 0 }) });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "vitest", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { root, vault, client, close: async () => { await client.close(); await server.close(); } };
}
