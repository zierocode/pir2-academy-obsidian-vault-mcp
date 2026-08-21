import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { McpbManifestSchema } from "@anthropic-ai/mcpb/schemas/0.4";
import { SECRET_PATTERNS } from "./secret-scan-policy.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE_PATH = resolve(ROOT, "dist/pir-acdm-obsidian-vault-0.4.0.mcpb");
const EXPECTED_TOOLS = [
  "obsidian_vault_status",
  "scan_obsidian_changes",
  "search_obsidian_knowledge",
  "explore_obsidian_graph",
  "read_obsidian_notes",
  "preview_obsidian_knowledge_build",
  "apply_obsidian_knowledge_build",
  "preview_obsidian_note_write",
  "apply_obsidian_note_write",
  "audit_obsidian_graph",
  "rollback_obsidian_change",
  "open_obsidian_note"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findEndOfCentralDirectory(archive) {
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("missing zip central directory");
}

function parseArchive(archive) {
  const end = findEndOfCentralDirectory(archive);
  const count = archive.readUInt16LE(end + 10);
  let offset = archive.readUInt32LE(end + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    assert(archive.readUInt32LE(offset) === 0x02014b50, "invalid central directory entry");
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const path = archive.toString("utf8", offset + 46, offset + 46 + nameLength);
    assert(archive.readUInt32LE(localOffset) === 0x04034b50, "invalid local zip entry");
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const payloadStart = localOffset + 30 + localNameLength + localExtraLength;
    const payload = archive.subarray(payloadStart, payloadStart + compressedSize);
    assert(payload.length === compressedSize, "truncated archive payload");
    assert(method === 8 || method === 0, "unsupported archive compression");
    entries.push({ path, data: method === 8 ? inflateRawSync(payload) : payload });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function safeArchivePath(path) {
  const normalized = path.split(sep).join("/");
  return normalized.length > 0 && !normalized.startsWith("/") && !normalized.includes("../") && !normalized.includes("\\");
}

function validateEntries(entries, archive) {
  const paths = entries.map((entry) => entry.path);
  assert(paths.length === new Set(paths).size, "duplicate archive path");
  assert(paths.every(safeArchivePath), "unsafe archive path");
  assert(paths.every((path, index) => index === 0 || paths[index - 1].localeCompare(path) <= 0), "archive paths are not deterministic");
  assert(paths.includes("manifest.json") && paths.includes("package.json"), "required package metadata is missing");
  assert(paths.includes("server/index.js"), "compiled server entry point is missing");
  assert(paths.includes("assets/icons/icon.png"), "bundle icon is missing");
  assert(paths.includes("LICENSE"), "bundle license is missing");
  assert(paths.includes("node_modules/@modelcontextprotocol/sdk/package.json"), "MCP SDK closure is missing");
  assert(paths.includes("node_modules/write-file-atomic/package.json"), "atomic write closure is missing");
  assert(paths.includes("node_modules/zod/package.json"), "schema closure is missing");
  assert(!paths.some((path) => path.startsWith("src/") || path.startsWith("tests/") || path.endsWith(".map") || /\.d\.(?:ts|cts|mts)$/u.test(path)), "source or type artifacts are bundled");
  assert(!paths.some((path) => path.startsWith(".env") || path.includes("package-lock") || path.endsWith(".mcpb")), "unexpected local artifact is bundled");
  assert(!archive.includes(Buffer.from(ROOT)), "bundle contains an absolute source path");
}

function validateManifest(entries) {
  const manifestEntry = entries.find((entry) => entry.path === "manifest.json");
  const packageEntry = entries.find((entry) => entry.path === "package.json");
  assert(manifestEntry && packageEntry, "package metadata is missing");
  const manifest = JSON.parse(manifestEntry.data.toString("utf8"));
  const packageJson = JSON.parse(packageEntry.data.toString("utf8"));
  assert(McpbManifestSchema.safeParse(manifest).success, "MCPB manifest schema validation failed");
  assert(manifest.name === "pir-acdm-obsidian-vault" && manifest.version === "0.4.0", "manifest identity drift");
  assert(packageJson.name === manifest.name && packageJson.version === manifest.version, "package identity drift");
  assert(manifest.server?.entry_point === "server/index.js", "unexpected server entry point");
  assert(entries.some((entry) => entry.path === manifest.icon), "manifest icon target is missing");
  assert(JSON.stringify(manifest.tools?.map((tool) => tool.name)) === JSON.stringify(EXPECTED_TOOLS), "tool catalog drift");
  assert(JSON.stringify(manifest.compatibility) === JSON.stringify({ platforms: ["darwin", "win32"], runtimes: { node: ">=20" } }), "compatibility drift");
  const serialized = JSON.stringify(manifest).toLowerCase();
  assert(!/credential|keyring|oauth|token|secret|password/u.test(serialized), "credential configuration is present");
}

function validateSecretPatterns(entries) {
  for (const entry of entries) {
    if (entry.path.startsWith("node_modules/")) continue;
    const content = entry.data.toString("utf8");
    for (const { expression } of SECRET_PATTERNS) {
      expression.lastIndex = 0;
      assert(!expression.test(content), "credential-shaped content is bundled");
    }
  }
}

function main() {
  assert(existsSync(BUNDLE_PATH), "bundle is unavailable");
  const archive = readFileSync(BUNDLE_PATH);
  const entries = parseArchive(archive);
  validateEntries(entries, archive);
  validateManifest(entries);
  validateSecretPatterns(entries);
  process.stdout.write(`bundle verification passed sha256=${createHash("sha256").update(archive).digest("hex")} files=${entries.length}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`bundle verification failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
}
