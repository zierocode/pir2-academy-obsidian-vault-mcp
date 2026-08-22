import { describe, expect, it } from "vitest";
import { createMcpServer } from "../../src/server.js";
import { createNoteWriter } from "../../src/vault/note-writer.js";
import { resolveApprovedVault } from "../../src/vault/vault-root.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

describe("managed source intake tool contract", () => {
  it("publishes three bounded closed schemas without parsing source content", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "pir-acdm-source-contract-"));
    const vaultPath = resolve(root, "vault");
    await mkdir(vaultPath);
    await writeFile(resolve(vaultPath, "README.md"), "# Vault\n", "utf8");
    const vault = await resolveApprovedVault(await realpath(vaultPath));
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
      const listed = await client.listTools();
      const schemas = Object.fromEntries(listed.tools.map((tool) => [tool.name, tool.inputSchema]));

      expect(schemas.inspect_obsidian_sources).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["paths"],
        properties: { paths: { minItems: 1, maxItems: 20 } }
      });
      expect(schemas.read_obsidian_source_content).toBeUndefined();
      expect(schemas.preview_obsidian_source_intake).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["sources", "notes"],
        properties: {
          sources: { maxItems: 20 },
          notes: { maxItems: 200 },
          managed_links: { maxItems: 500 }
        }
      });
      expect(schemas.apply_obsidian_source_intake).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["preview_id", "confirmation"]
      });
    } finally {
      await client.close();
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
