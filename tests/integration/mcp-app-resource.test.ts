import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpServer } from "../../src/server.js";
import { createNoteWriter } from "../../src/vault/note-writer.js";
import { resolveApprovedVault } from "../../src/vault/vault-root.js";

const RESOURCE_URI = "ui://pir2-academy-obsidian-vault/second-brain-workspace.html";
const roots: string[] = [];

function createVault(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-second-brain-app-"));
  roots.push(root);
  const vault = resolve(root, "vault");
  mkdirSync(vault);
  return realpathSync(vault);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("Second Brain MCP App resource", () => {
  it("lists, reads and links the inline workspace resource", async () => {
    const vault = await resolveApprovedVault(createVault());
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

      const listedTools = await client.listTools();
      const renderTool = listedTools.tools.find((tool) => tool.name === "render_second_brain_workspace");
      expect(renderTool?._meta).toMatchObject({ ui: { resourceUri: RESOURCE_URI } });

      const listedResources = await client.listResources();
      expect(listedResources.resources).toEqual([
        expect.objectContaining({ uri: RESOURCE_URI, name: "พื้นที่ทำงาน Second Brain" })
      ]);

      const resource = await client.readResource({ uri: RESOURCE_URI });
      expect(resource.contents[0]).toMatchObject({ uri: RESOURCE_URI });
      expect(resource.contents[0].mimeType).toContain("text/html");
      expect("text" in resource.contents[0] ? resource.contents[0].text : "").toContain("พื้นที่ทำงาน Second Brain");

      const rendered = await client.callTool({
        name: "render_second_brain_workspace",
        arguments: {
          view: {
            kind: "project_picker",
            title: "ข้อมูลนี้เกี่ยวข้องกับโปรเจกต์ไหน?",
            options: [
              { id: "new-branch", label: "คอมมอนกราวด์ — โครงการสาขาใหม่", message: "เลือกคอมมอนกราวด์ — โครงการสาขาใหม่" },
              { id: "new-project", label: "สร้างโปรเจกต์ใหม่", message: "สร้างโปรเจกต์ใหม่" }
            ]
          }
        }
      });
      expect(rendered.structuredContent).toMatchObject({
        ok: true,
        data: { view: { kind: "project_picker" } }
      });

      const renderedFromHostAlias = await client.callTool({
        name: "render_second_brain_workspace",
        arguments: {
          view: {
            type: "project_picker",
            title: "เลือกโปรเจกต์ก่อนเริ่ม",
            status: { vault: "พร้อมใช้งาน" },
            options: [
              {
                id: "new-branch",
                label: "คอมมอนกราวด์ — โครงการสาขาใหม่",
                description: "พบแหล่งข้อมูลที่เกี่ยวข้อง",
                message: "เลือกคอมมอนกราวด์ — โครงการสาขาใหม่"
              }
            ]
          }
        }
      });
      expect(renderedFromHostAlias.structuredContent).toMatchObject({
        ok: true,
        data: { view: { kind: "project_picker" } }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
