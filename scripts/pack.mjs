import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import { buildSync } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE_NAME = "pir2-academy-obsidian-vault-0.2.0.mcpb";
const OUTPUT_PATH = resolve(ROOT, "dist", BUNDLE_NAME);
const MCPB_CLI_PATH = resolve(ROOT, "node_modules/@anthropic-ai/mcpb/dist/cli/cli.js");
const OMITTED_DIRECTORIES = new Set([".git", ".github", "docs", "examples", "node_modules", "src", "test", "tests", "__tests__"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function buildBundleServer() {
  const stage = mkdtempSync(resolve(tmpdir(), "pir2-academy-obsidian-mcpb-"));
  const serverPath = resolve(stage, "server");
  buildSync({
    entryPoints: [resolve(ROOT, "src/index.ts")],
    outfile: resolve(serverPath, "index.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
    sourcemap: false,
    legalComments: "none",
    logLevel: "silent"
  });
  return { stage, serverPath };
}

function validateManifest() {
  const result = spawnSync(process.execPath, [MCPB_CLI_PATH, "validate", "manifest.json"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false
  });
  assert(result.status === 0, "MCPB manifest validation failed");
}

function validateIdentity() {
  const packageJson = readJson(resolve(ROOT, "package.json"));
  const manifest = readJson(resolve(ROOT, "manifest.json"));
  assert(packageJson.name === "pir2-academy-obsidian-vault" && packageJson.version === "0.2.0", "package identity drift");
  assert(manifest.name === packageJson.name && manifest.version === packageJson.version, "manifest identity drift");
  assert(manifest.server?.entry_point === "server/index.js", "unexpected server entry point");
  assert(Array.isArray(manifest.tools) && manifest.tools.length === 7, "unexpected tool catalog");
  assert(typeof manifest.icon === "string" && existsSync(resolve(ROOT, manifest.icon)), "bundle icon is unavailable");
  return { packageJson, manifest };
}

function safeArchivePath(path) {
  const normalized = path.split(sep).join("/");
  assert(
    normalized.length > 0 &&
      !normalized.startsWith("/") &&
      !normalized.includes("\\") &&
      /^[A-Za-z0-9._/-]+$/u.test(normalized) &&
      normalized.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    "unsafe archive path"
  );
  return normalized;
}

function shouldSkip(relativePath, includeMarkdown = false) {
  const segments = relativePath.split(sep);
  const base = segments.at(-1) ?? "";
  return segments.some((segment) => OMITTED_DIRECTORIES.has(segment)) ||
    base.endsWith(".map") ||
    /\.d\.(?:ts|cts|mts)$/u.test(base) ||
    (!includeMarkdown && base.endsWith(".md")) ||
    base === ".DS_Store";
}

function addFile(entries, archivePath, sourcePath) {
  const path = safeArchivePath(archivePath);
  assert(!entries.has(path), "duplicate archive file");
  entries.set(path, readFileSync(sourcePath));
}

function addTree(entries, sourceRoot, archiveRoot, includeMarkdown = false) {
  const visit = (current, relativePath = "") => {
    const directory = lstatSync(current);
    assert(directory.isDirectory() && !directory.isSymbolicLink(), "unsafe package directory");
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const nextRelative = relativePath ? join(relativePath, entry.name) : entry.name;
      if (shouldSkip(nextRelative, includeMarkdown)) continue;
      const sourcePath = join(current, entry.name);
      const details = lstatSync(sourcePath);
      assert(!details.isSymbolicLink(), "symbolic links are not allowed in the bundle");
      if (details.isDirectory()) {
        visit(sourcePath, nextRelative);
      } else if (details.isFile()) {
        addFile(entries, join(archiveRoot, nextRelative), sourcePath);
      }
    }
  };
  visit(sourceRoot);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createDeterministicZip(entries) {
  assert(entries.size <= 0xffff, "archive has too many entries");
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;
  for (const [path, data] of [...entries.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const name = Buffer.from(path, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    assert(name.length <= 0xffff && data.length <= 0xffffffff && compressed.length <= 0xffffffff, "archive entry is too large");
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localRecords.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralRecords.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const central = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.size, 8);
  end.writeUInt16LE(entries.size, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localRecords, central, end]);
}

function main() {
  const build = buildBundleServer();
  try {
    validateIdentity();
    validateManifest();
    const entries = new Map();
    for (const file of ["manifest.json", "package.json", "README.md", "LICENSE", "NOTICE-UPSTREAM.md", "SECURITY.md"]) {
      addFile(entries, file, resolve(ROOT, file));
    }
    addTree(entries, resolve(ROOT, "assets", "icons"), "assets/icons");
    addTree(entries, build.serverPath, "server");
    const archive = createDeterministicZip(entries);
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    const temporaryOutput = `${OUTPUT_PATH}.${process.pid}.tmp`;
    rmSync(temporaryOutput, { force: true });
    writeFileSync(temporaryOutput, archive, { mode: 0o644 });
    renameSync(temporaryOutput, OUTPUT_PATH);
    process.stdout.write(`bundle=dist/${BUNDLE_NAME} sha256=${createHash("sha256").update(archive).digest("hex")} files=${entries.size}\n`);
  } finally {
    rmSync(build.stage, { force: true, recursive: true });
  }
}

try {
  main();
} catch {
  process.stderr.write("bundle failed\n");
  process.exitCode = 1;
}
