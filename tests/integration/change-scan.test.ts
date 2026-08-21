import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("scan_obsidian_changes", () => {
  it("reports pending external files without mutating the registry", async () => {
    const [{ resolveApprovedVault }, { createNoteWriter }, { createMcpServer }] = await Promise.all([
      import("../../src/vault/vault-root.js"),
      import("../../src/vault/note-writer.js"),
      import("../../src/server.js")
    ]);
    const parent = mkdtempSync(resolve(tmpdir(), "pir-acdm-scan-tool-"));
    roots.push(parent);
    const root = resolve(parent, "vault");
    mkdirSync(root);
    writeFileSync(resolve(root, "ข้อมูลใหม่.txt"), "ข้อมูลจาก Explorer");
    const vault = await resolveApprovedVault(realpathSync(root));
    const server = createMcpServer({
      vault,
      writer: createNoteWriter({ vault }),
      runCli: async () => ({ stdout: "", stderr: "", exitCode: 0 })
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "vitest", version: "1.0.0" });

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({ name: "scan_obsidian_changes", arguments: { mode: "preflight" } });

      expect(result.structuredContent).toMatchObject({
        ok: true,
        data: {
          state: "uninitialized",
          count: 1,
          changes: [{ kind: "new", path: "ข้อมูลใหม่.txt" }]
        }
      });
      expect(existsSync(resolve(root, ".pir-acdm/source-registry.json"))).toBe(false);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
