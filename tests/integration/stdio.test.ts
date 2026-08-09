import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const SERVER_PATH = resolve(ROOT, "server/index.js");
const TSC_PATH = resolve(ROOT, "node_modules/typescript/bin/tsc");
const temporaryRoots: string[] = [];

function createVault(): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-stdio-"));
  temporaryRoots.push(root);
  const vault = resolve(root, "vault");
  mkdirSync(vault);
  return vault;
}

function compileServer(): void {
  execFileSync(process.execPath, [TSC_PATH, "--project", "tsconfig.json"], { cwd: ROOT, stdio: "pipe" });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("compiled Obsidian MCP stdio server", () => {
  it("initializes, lists tools, and applies only an explicitly confirmed preview without calling Obsidian", async () => {
    compileServer();
    expect(existsSync(SERVER_PATH)).toBe(true);
    const vault = createVault();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER_PATH],
      cwd: ROOT,
      env: { ...process.env, APPROVED_VAULT_ROOT: vault },
      stderr: "pipe"
    });
    const client = new Client({ name: "vitest", version: "1.0.0" });

    try {
      await client.connect(transport);
      const listed = await client.listTools();
      expect(listed.tools).toHaveLength(6);

      const premature = await client.callTool({
        name: "apply_obsidian_note_write",
        arguments: { preview_id: "missing", confirmation: "ยืนยันบันทึก" }
      });
      expect(premature).toMatchObject({ isError: true, structuredContent: { code: "WRITE_PREVIEW_REQUIRED" } });

      const preview = await client.callTool({
        name: "preview_obsidian_note_write",
        arguments: { path: "lesson.md", content: "safe content\n", mode: "create" }
      });
      const previewData = preview.structuredContent as { ok: boolean; data?: { preview_id?: string } };
      expect(previewData).toMatchObject({ ok: true, data: { preview_id: expect.any(String) } });
      expect(existsSync(resolve(vault, "lesson.md"))).toBe(false);

      const applied = await client.callTool({
        name: "apply_obsidian_note_write",
        arguments: { preview_id: previewData.data!.preview_id, confirmation: "ยืนยันบันทึก" }
      });
      expect(applied.isError).toBeUndefined();
      expect(applied.structuredContent).toMatchObject({ ok: true, code: "OK" });
      expect(readFileSync(resolve(vault, "lesson.md"), "utf8")).toBe("safe content\n");
      expect(JSON.stringify([preview, applied])).not.toContain(vault);
    } finally {
      await client.close();
    }
  });
});
