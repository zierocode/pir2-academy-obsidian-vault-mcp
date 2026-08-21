import { createHash, randomUUID } from "node:crypto";
import { mkdir, opendir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { VaultToolError } from "../errors.js";
import { buildGraph, type GraphInput } from "../graph/graph-builder.js";
import { auditGraph, type GraphAuditIssue } from "../graph/audit.js";
import { saveGraphIndex } from "../graph/graph-store.js";
import { scanVaultChanges } from "./change-scanner.js";
import { resolveNotePath } from "./note-path.js";
import { readSourceRegistry, saveSourceRegistry } from "./source-registry.js";
import type { ApprovedVault } from "./vault-root.js";

const PREVIEW_TTL_MS = 10 * 60 * 1000;
const CONFIRMATIONS = new Set(["ยืนยันบันทึก", "Confirm write"]);

export type KnowledgeBuildInput = {
  mode: "initialize" | "refresh" | "repair";
  notes: Array<{ path: string; content: string; mode: "create" | "replace" }>;
  managedLinks: Array<{ from: string; to: string; relation: string }>;
};

type PlannedFile = {
  path: string;
  absolutePath: string;
  beforeContent: string | null;
  beforeHash: string | null;
  proposedContent: string;
  proposedHash: string;
};

export type KnowledgePreview = {
  previewId: string;
  mode: KnowledgeBuildInput["mode"];
  files: PlannedFile[];
  fileCount: number;
  nodeCount: number;
  edgeCount: number;
  healthy: boolean;
  auditIssues: GraphAuditIssue[];
  expiresAt: number;
};

export type KnowledgeReceipt = {
  receiptId: string;
  changedFiles: string[];
  backupPaths: string[];
  files: Array<{
    path: string;
    beforeHash: string | null;
    proposedHash: string;
    backupPath?: string;
  }>;
  graph: { nodes: number; edges: number; healthy: boolean; issues: number };
};

export type KnowledgeWriter = {
  previewBuild(input: KnowledgeBuildInput): Promise<KnowledgePreview>;
  applyBuild(previewId: string, confirmation: string): Promise<KnowledgeReceipt>;
};

export type KnowledgeWriterOptions = {
  vault: ApprovedVault;
  now?: () => number;
  previewId?: () => string;
  receiptId?: () => string;
  atomicWrite?: (path: string, content: string) => Promise<void>;
};

export function createKnowledgeWriter(options: KnowledgeWriterOptions): KnowledgeWriter {
  const previews = new Map<string, KnowledgePreview>();
  const now = options.now ?? Date.now;
  const nextPreviewId = options.previewId ?? randomUUID;
  const nextReceiptId = options.receiptId ?? randomUUID;
  const writeTarget = options.atomicWrite ?? defaultAtomicWrite;

  return {
    async previewBuild(input): Promise<KnowledgePreview> {
      if (input.notes.length > 200) throw new VaultToolError("GRAPH_LIMIT_EXCEEDED", "too many note changes");
      if (input.managedLinks.length > 0) {
        throw new VaultToolError(
          "GRAPH_CONFLICT",
          "managed_links cannot create virtual graph edges; include real Obsidian wikilinks in note content"
        );
      }
      const planned: PlannedFile[] = [];
      const seen = new Set<string>();
      for (const note of input.notes) {
        const resolved = await resolveNotePath(options.vault, note.path);
        if (seen.has(resolved.relativePath)) throw new VaultToolError("GRAPH_CONFLICT", "duplicate target");
        seen.add(resolved.relativePath);
        const current = await readOptional(resolved.absolutePath);
        if (note.mode === "create" && current !== null) throw new VaultToolError("GRAPH_CONFLICT", "create target exists");
        if (note.mode === "replace" && current === null) throw new VaultToolError("NOTE_NOT_FOUND", "replace target is missing");
        planned.push({
          path: resolved.relativePath,
          absolutePath: resolved.absolutePath,
          beforeContent: current,
          beforeHash: hash(current),
          proposedContent: note.content,
          proposedHash: hash(note.content)!
        });
      }
      const graph = buildGraph(await proposedGraphInputs(options.vault, planned));
      const audit = auditGraph(graph);
      const createdAt = now();
      const preview: KnowledgePreview = {
        previewId: nextPreviewId(),
        mode: input.mode,
        files: planned,
        fileCount: planned.length,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        healthy: audit.healthy,
        auditIssues: audit.issues,
        expiresAt: createdAt + PREVIEW_TTL_MS
      };
      previews.set(preview.previewId, preview);
      return preview;
    },

    async applyBuild(previewId, confirmation): Promise<KnowledgeReceipt> {
      const pending = previews.get(previewId);
      if (!pending) throw new VaultToolError("BUILD_PREVIEW_REQUIRED", "knowledge preview is required");
      if (!CONFIRMATIONS.has(confirmation)) throw new VaultToolError("WRITE_NOT_CONFIRMED", "exact confirmation is required");
      previews.delete(previewId);
      if (now() > pending.expiresAt) throw new VaultToolError("BUILD_PREVIEW_EXPIRED", "knowledge preview expired");

      for (const file of pending.files) {
        if (hash(await readOptional(file.absolutePath)) !== file.beforeHash) {
          throw new VaultToolError("GRAPH_CONFLICT", "a target changed after preview");
        }
      }

      const receiptId = nextReceiptId();
      const backupRoot = resolve(options.vault.realRoot, ".pir-acdm", "backups", receiptId);
      const backups: string[] = [];
      const fileReceipts: KnowledgeReceipt["files"] = [];
      const written: PlannedFile[] = [];
      try {
        for (const file of pending.files) {
          await mkdir(dirname(file.absolutePath), { recursive: true, mode: 0o700 });
          await resolveNotePath(options.vault, file.path);
          if (file.beforeContent !== null) {
            const backupPath = resolve(backupRoot, ...file.path.split("/"));
            await mkdir(dirname(backupPath), { recursive: true, mode: 0o700 });
            await writeFile(backupPath, file.beforeContent, { encoding: "utf8", flag: "wx", mode: 0o600 });
            backups.push(relativeToVault(options.vault, backupPath));
          }
          await writeTarget(file.absolutePath, file.proposedContent);
          written.push(file);
          const backupPath = file.beforeContent === null
            ? undefined
            : `.pir-acdm/backups/${receiptId}/${file.path}`;
          fileReceipts.push({
            path: file.path,
            beforeHash: file.beforeHash,
            proposedHash: file.proposedHash,
            ...(backupPath ? { backupPath } : {})
          });
        }

        const graph = buildGraph(await loadVaultGraphInputs(options.vault));
        const audit = auditGraph(graph);
        await saveGraphIndex(options.vault, graph, now);
        const registry = await readSourceRegistry(options.vault);
        const scan = await scanVaultChanges(options.vault, registry, now);
        await saveSourceRegistry(options.vault, scan.nextRegistry);
        const receipt: KnowledgeReceipt = {
          receiptId,
          changedFiles: pending.files.map((file) => file.path),
          backupPaths: backups,
          files: fileReceipts,
          graph: {
            nodes: graph.nodes.length,
            edges: graph.edges.length,
            healthy: audit.healthy,
            issues: audit.issues.length
          }
        };
        const receiptPath = resolve(options.vault.realRoot, ".pir-acdm", "receipts", `${receiptId}.json`);
        await mkdir(dirname(receiptPath), { recursive: true, mode: 0o700 });
        await defaultAtomicWrite(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
        return receipt;
      } catch (error) {
        await restoreWritten(written);
        if (error instanceof VaultToolError) throw error;
        throw new VaultToolError("OBSIDIAN_CLI_ERROR", "knowledge transaction was restored");
      }
    }
  };

  async function restoreWritten(files: readonly PlannedFile[]): Promise<void> {
    for (const file of [...files].reverse()) {
      if (file.beforeContent === null) {
        await unlink(file.absolutePath).catch(() => undefined);
      } else {
        await defaultAtomicWrite(file.absolutePath, file.beforeContent);
      }
    }
  }
}

async function proposedGraphInputs(vault: ApprovedVault, planned: readonly PlannedFile[]): Promise<GraphInput[]> {
  const inputs = await loadVaultGraphInputs(vault);
  const byPath = new Map(inputs.map((input) => [input.path, input]));
  for (const file of planned) byPath.set(file.path, { path: file.path, content: file.proposedContent });
  return [...byPath.values()];
}

export async function loadVaultGraphInputs(vault: ApprovedVault): Promise<GraphInput[]> {
  const inputs: GraphInput[] = [];
  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const handle = await opendir(directory);
    for await (const entry of handle) {
      if ([".obsidian", ".pir-acdm", ".git", ".pir2-academy-backups"].includes(entry.name)) continue;
      const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolute = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile() && entry.name.endsWith(".md")) inputs.push({ path: relative, content: await readFile(absolute, "utf8") });
    }
  }
  await visit(vault.realRoot, "");
  return inputs.sort((left, right) => left.path.localeCompare(right.path));
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function defaultAtomicWrite(path: string, content: string): Promise<void> {
  await writeFileAtomic(path, content, { encoding: "utf8", mode: 0o600, fsync: true });
}

function hash(content: string | null): string | null {
  return content === null ? null : createHash("sha256").update(content).digest("hex");
}

function isNotFound(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

function relativeToVault(vault: ApprovedVault, absolutePath: string): string {
  return absolutePath.slice(vault.realRoot.length + 1).split(sep).join("/");
}
