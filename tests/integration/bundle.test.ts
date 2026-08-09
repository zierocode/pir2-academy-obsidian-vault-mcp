import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep, win32 } from "node:path";
import { inflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const BUNDLE_PATH = resolve(ROOT, "dist/pir2-academy-obsidian-vault-0.1.0.mcpb");
const temporaryRoots: string[] = [];

type ArchiveEntry = { path: string; data: Buffer };
type PathApi = Pick<typeof win32, "isAbsolute" | "relative" | "sep">;

function runNpm(script: "bundle" | "bundle:verify") {
  if (!process.env.npm_execpath) throw new Error("npm_execpath is required for repository script tests");
  return spawnSync(process.execPath, [process.env.npm_execpath, "run", script], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000
  });
}

function parseArchive(archive: Buffer): ArchiveEntry[] {
  const end = findEndOfCentralDirectory(archive);
  const count = archive.readUInt16LE(end + 10);
  let offset = archive.readUInt32LE(end + 16);
  const entries: ArchiveEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    expect(archive.readUInt32LE(offset)).toBe(0x02014b50);
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const path = archive.toString("utf8", offset + 46, offset + 46 + nameLength);
    expect(archive.readUInt32LE(localOffset)).toBe(0x04034b50);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const payload = archive.subarray(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize);
    entries.push({ path, data: method === 8 ? inflateRawSync(payload) : payload });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndOfCentralDirectory(archive: Buffer): number {
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("missing zip central directory");
}

function isInsideRoot(root: string, destination: string, path: PathApi): boolean {
  const relation = path.relative(root, destination);
  return relation !== "" && relation !== ".." && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation);
}

function extract(entries: ArchiveEntry[]): string {
  const root = mkdtempSync(resolve(tmpdir(), "pir2-obsidian-bundle-"));
  temporaryRoots.push(root);
  for (const entry of entries) {
    const destination = resolve(root, entry.path);
    expect(isInsideRoot(root, destination, { isAbsolute, relative, sep })).toBe(true);
    mkdirSync(resolve(destination, ".."), { recursive: true });
    writeFileSync(destination, entry.data);
  }
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("deterministic MCPB bundle", () => {
  it("recognizes a safe extraction destination with Windows path separators", () => {
    const root = win32.resolve("C:\\temporary", "pir2-obsidian-bundle");
    const destination = win32.resolve(root, "server", "index.js");
    const escape = win32.resolve(root, "..", "escape.js");

    expect(isInsideRoot(root, destination, win32)).toBe(true);
    expect(isInsideRoot(root, escape, win32)).toBe(false);
  });

  it("produces the exact safe archive path and byte-identical contents", () => {
    const firstRun = runNpm("bundle");
    expect(firstRun.status, firstRun.stderr).toBe(0);
    expect(existsSync(BUNDLE_PATH)).toBe(true);
    const first = readFileSync(BUNDLE_PATH);
    const secondRun = runNpm("bundle");
    expect(secondRun.status, secondRun.stderr).toBe(0);
    const second = readFileSync(BUNDLE_PATH);

    expect(second.equals(first)).toBe(true);
    expect(firstRun.stdout).toContain(`sha256=${createHash("sha256").update(first).digest("hex")}`);
    const entries = parseArchive(first);
    const paths = entries.map((entry) => entry.path);
    expect(paths).toEqual([...paths].sort((left, right) => left.localeCompare(right)));
    expect(paths).toEqual(expect.arrayContaining([
      "manifest.json",
      "package.json",
      "README.md",
      "LICENSE",
      "SECURITY.md",
      "assets/icons/icon.png",
      "server/index.js",
      "node_modules/@modelcontextprotocol/sdk/package.json",
      "node_modules/write-file-atomic/package.json",
      "node_modules/zod/package.json"
    ]));
    expect(paths.some((path) => path.startsWith("src/") || path.startsWith("tests/") || path.endsWith(".map") || /\.d\.(?:ts|cts|mts)$/u.test(path))).toBe(false);
    expect(paths.some((path) => path.includes("package-lock") || path.startsWith(".env"))).toBe(false);
    expect(first.includes(Buffer.from(ROOT))).toBe(false);

    const manifest = JSON.parse(entries.find((entry) => entry.path === "manifest.json")!.data.toString("utf8")) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      manifest_version: "0.4",
      name: "pir2-academy-obsidian-vault",
      version: "0.1.0",
      compatibility: { platforms: ["darwin", "win32"], runtimes: { node: ">=20" } },
      server: { entry_point: "server/index.js" }
    });
    expect((manifest.tools as Array<{ name: string }>).map((tool) => tool.name)).toEqual([
      "obsidian_vault_status",
      "search_obsidian_notes",
      "read_obsidian_notes",
      "preview_obsidian_note_write",
      "apply_obsidian_note_write",
      "open_obsidian_note"
    ]);
  }, 30_000);

  it("contains an executable Node entry point and passes bundle verification", () => {
    const bundle = runNpm("bundle");
    expect(bundle.status, bundle.stderr).toBe(0);
    const root = extract(parseArchive(readFileSync(BUNDLE_PATH)));
    const vault = resolve(root, "temporary-vault");
    mkdirSync(vault);
    const server = spawnSync(process.execPath, [resolve(root, "server/index.js")], {
      cwd: root,
      env: { ...process.env, APPROVED_VAULT_ROOT: vault },
      input: "",
      encoding: "utf8",
      timeout: 5_000
    });
    expect(server.error).toBeUndefined();
    expect(server.status).toBe(0);
    expect(server.stdout).toBe("");
    expect(server.stderr).not.toContain(vault);

    const verified = runNpm("bundle:verify");
    expect(verified.status, verified.stderr).toBe(0);
    expect(verified.stdout).toContain("bundle verification passed");
  }, 30_000);
});
