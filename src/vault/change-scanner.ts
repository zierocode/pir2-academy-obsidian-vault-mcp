import { createHash } from "node:crypto";
import { opendir, readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { ApprovedVault } from "./vault-root.js";
import type { SourceRecord, SourceRegistry } from "./source-registry.js";

export type ChangeKind = "new" | "changed" | "unchanged" | "duplicate" | "moved" | "missing" | "manual_edit" | "unsupported";

export type SourceChange = {
  kind: ChangeKind;
  id: string;
  path: string;
  previousPath?: string;
  duplicateOf?: string;
  revisionParentHash?: string;
};

export type ChangeScanResult = {
  changes: SourceChange[];
  nextRegistry: SourceRegistry;
};

const IGNORE_ROOTS = new Set([".obsidian", ".pir-acdm", ".git", ".pir2-academy-backups"]);
const IGNORE_SUFFIXES = [".tmp", ".temp", ".swp", ".lock", "~"];

export async function scanVaultChanges(
  vault: ApprovedVault,
  registry: SourceRegistry,
  now: () => number = Date.now
): Promise<ChangeScanResult> {
  const files = await listFiles(vault.realRoot);
  const previousByPath = new Map(registry.records.map((record) => [record.path, record]));
  const unmatchedPrevious = new Set(registry.records.map((record) => record.id));
  const active: SourceRecord[] = [];
  const changes: SourceChange[] = [];
  const activeByHash = new Map<string, SourceRecord>();
  const timestamp = now();

  for (const file of files) {
    const old = previousByPath.get(file.path);
    if (old) {
      unmatchedPrevious.delete(old.id);
      if (old.sha256 === file.sha256) {
        const record = updateRecord(old, file, timestamp);
        active.push(record);
        activeByHash.set(record.sha256, record);
        continue;
      }
      const record = updateRecord(old, file, timestamp, old.sha256);
      active.push(record);
      activeByHash.set(record.sha256, record);
      changes.push({
        kind: old.role === "generated" ? "manual_edit" : "changed",
        id: old.id,
        path: file.path,
        revisionParentHash: old.sha256
      });
      continue;
    }

    const movedFrom = registry.records.find((record) => unmatchedPrevious.has(record.id) && record.sha256 === file.sha256);
    if (movedFrom) {
      unmatchedPrevious.delete(movedFrom.id);
      const record = updateRecord(movedFrom, file, timestamp);
      active.push(record);
      activeByHash.set(record.sha256, record);
      changes.push({ kind: "moved", id: record.id, path: file.path, previousPath: movedFrom.path });
      continue;
    }

    const duplicate = activeByHash.get(file.sha256) ?? registry.records.find((record) => record.sha256 === file.sha256);
    const record = newRecord(file, timestamp);
    active.push(record);
    activeByHash.set(record.sha256, activeByHash.get(record.sha256) ?? record);
    changes.push(duplicate
      ? { kind: "duplicate", id: record.id, path: file.path, duplicateOf: duplicate.id }
      : { kind: "new", id: record.id, path: file.path });
  }

  for (const old of registry.records) {
    if (!unmatchedPrevious.has(old.id)) continue;
    active.push({ ...old, missing: true });
    changes.push({ kind: "missing", id: old.id, path: old.path });
  }

  active.sort((left, right) => left.path.localeCompare(right.path));
  changes.sort((left, right) => left.path.localeCompare(right.path));
  return { changes, nextRegistry: { schemaVersion: 1, records: active } };
}

type ScannedFile = { path: string; type: string; size: number; modifiedTime: number; sha256: string };

async function listFiles(root: string): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];
  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const handle = await opendir(directory);
    for await (const entry of handle) {
      const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (shouldIgnore(relative, entry.name)) continue;
      const absolute = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await visit(absolute, relative);
      } else if (entry.isFile()) {
        const metadata = await stat(absolute);
        const content = await readFile(absolute);
        results.push({
          path: relative.split(sep).join("/"),
          type: extname(entry.name).toLowerCase(),
          size: metadata.size,
          modifiedTime: metadata.mtimeMs,
          sha256: createHash("sha256").update(content).digest("hex")
        });
      }
    }
  }
  await visit(root, "");
  return results.sort((left, right) => left.path.localeCompare(right.path));
}

function shouldIgnore(relative: string, name: string): boolean {
  const first = relative.split("/", 1)[0]!;
  if (IGNORE_ROOTS.has(first)) return true;
  if (name.startsWith("~$") || name === ".DS_Store") return true;
  return IGNORE_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function updateRecord(old: SourceRecord, file: ScannedFile, timestamp: number, revisionParentHash?: string): SourceRecord {
  return {
    ...old,
    path: file.path,
    type: file.type,
    size: file.size,
    modifiedTime: file.modifiedTime,
    sha256: file.sha256,
    lastSeen: timestamp,
    ...(revisionParentHash ? { revisionParentHash } : {}),
    missing: false
  };
}

function newRecord(file: ScannedFile, timestamp: number): SourceRecord {
  return {
    id: `src-${createHash("sha256").update(`${file.path}\0${file.sha256}`).digest("hex").slice(0, 16)}`,
    path: file.path,
    type: file.type,
    role: "source",
    size: file.size,
    modifiedTime: file.modifiedTime,
    sha256: file.sha256,
    firstImported: timestamp,
    lastSeen: timestamp,
    projectLinks: [],
    generatedNoteLinks: []
  };
}
