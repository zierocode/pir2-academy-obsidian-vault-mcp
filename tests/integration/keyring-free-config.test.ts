import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const BUNDLE_PATH = resolve(ROOT, "dist/pir2-academy-obsidian-vault-0.2.6.mcpb");

function bundleManifest(): Record<string, unknown> {
  if (!process.env.npm_execpath) throw new Error("npm_execpath is required for repository script tests");
  const built = spawnSync(process.execPath, [process.env.npm_execpath, "run", "bundle"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000
  });
  expect(built.status, built.stderr).toBe(0);
  const archive = readFileSync(BUNDLE_PATH);
  const end = findEndOfCentralDirectory(archive);
  const count = archive.readUInt16LE(end + 10);
  let offset = archive.readUInt32LE(end + 16);
  for (let index = 0; index < count; index += 1) {
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const path = archive.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (path === "manifest.json") {
      const method = archive.readUInt16LE(offset + 10);
      const compressedSize = archive.readUInt32LE(offset + 20);
      const localOffset = archive.readUInt32LE(offset + 42);
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const payload = archive.subarray(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize);
      return JSON.parse((method === 8 ? inflateRawSync(payload) : payload).toString("utf8")) as Record<string, unknown>;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("bundle has no manifest");
}

function findEndOfCentralDirectory(archive: Buffer): number {
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("missing zip central directory");
}

describe("configuration-free Cowork companion", () => {
  it("ships no duplicate vault setting, credential or keyring configuration", () => {
    const manifest = bundleManifest();
    const serialized = JSON.stringify(manifest).toLowerCase();

    expect(serialized).not.toMatch(/credential|keyring|oauth|token|secret|password/);
    expect(manifest.user_config).toBeUndefined();
    expect((manifest.server as { mcp_config?: { env?: Record<string, string> } }).mcp_config?.env).toBeUndefined();
    expect((manifest.tools as Array<{ name: string }>).map((tool) => tool.name)).toEqual([
      "render_second_brain_workspace"
    ]);
  }, 30_000);
});
