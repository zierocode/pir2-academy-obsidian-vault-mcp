import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const TSC_PATH = resolve(ROOT, "node_modules/typescript/bin/tsc");
const temporaryRoots: string[] = [];

function compileServer(): string {
  const outputRoot = mkdtempSync(resolve(ROOT, ".test-server-"));
  temporaryRoots.push(outputRoot);
  execFileSync(process.execPath, [TSC_PATH, "--project", "tsconfig.json", "--outDir", outputRoot], { cwd: ROOT, stdio: "pipe" });
  return resolve(outputRoot, "index.js");
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("compiled Obsidian MCP stdio server", () => {
  it("initializes without folder configuration and exposes only the Thai-first interactive UI", async () => {
    const serverPath = compileServer();
    expect(existsSync(serverPath)).toBe(true);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      cwd: ROOT,
      env: process.env,
      stderr: "pipe"
    });
    const client = new Client({ name: "vitest", version: "1.0.0" });

    try {
      await client.connect(transport);
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name)).toEqual(["render_second_brain_workspace"]);

      const rendered = await client.callTool({
        name: "render_second_brain_workspace",
        arguments: {
          view: {
            kind: "project_picker",
            title: "เลือกโปรเจกต์ก่อนเริ่ม",
            options: [{ id: "thai-project", label: "คอมมอนกราวด์ — โครงการสาขาใหม่", message: "เลือกโครงการสาขาใหม่" }]
          }
        }
      });
      expect(rendered.isError).toBeUndefined();
      expect(rendered.structuredContent).toMatchObject({ ok: true, data: { view: { kind: "project_picker" } } });
    } finally {
      await client.close();
    }
  }, 30_000);
});
