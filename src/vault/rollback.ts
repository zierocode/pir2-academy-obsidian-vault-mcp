import { createHash } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { VaultToolError } from "../errors.js";
import { buildGraph } from "../graph/graph-builder.js";
import { saveGraphIndex } from "../graph/graph-store.js";
import { scanVaultChanges } from "./change-scanner.js";
import { loadVaultGraphInputs } from "./knowledge-writer.js";
import { resolveNotePath } from "./note-path.js";
import { readSourceRegistry, saveSourceRegistry } from "./source-registry.js";
import type { ApprovedVault } from "./vault-root.js";

const CONFIRMATIONS = new Set(["ยืนยันบันทึก", "Confirm write"]);
const receiptSchema = z.object({
  receiptId: z.string(),
  files: z.array(z.object({
    path: z.string(),
    beforeHash: z.string().length(64).nullable(),
    proposedHash: z.string().length(64),
    backupPath: z.string().optional()
  }).strict())
}).passthrough();

export async function rollbackKnowledgeChange(
  vault: ApprovedVault,
  receiptId: string,
  confirmation: string
): Promise<{ rolledBackReceiptId: string; restoredFiles: string[]; removedCreatedFiles: string[] }> {
  if (!CONFIRMATIONS.has(confirmation)) throw new VaultToolError("WRITE_NOT_CONFIRMED", "exact confirmation is required");
  const receipt = await readReceipt(vault, receiptId);
  const targets = await Promise.all(receipt.files.map(async (file) => {
    const note = await resolveReceiptTarget(vault, file.path);
    const current = await readOptionalBuffer(note.absolutePath);
    if (hash(current) !== file.proposedHash) throw new VaultToolError("ROLLBACK_CONFLICT", "target changed after transaction");
    const backup = file.backupPath ? await readOptionalBuffer(resolve(vault.realRoot, ...file.backupPath.split("/"))) : null;
    if (file.beforeHash !== null && hash(backup) !== file.beforeHash) {
      throw new VaultToolError("ROLLBACK_CONFLICT", "backup is unavailable or changed");
    }
    return { file, note, backup };
  }));

  const restoredFiles: string[] = [];
  const removedCreatedFiles: string[] = [];
  for (const target of targets) {
    if (target.file.beforeHash === null) {
      await unlink(target.note.absolutePath);
      removedCreatedFiles.push(target.file.path);
    } else {
      await atomicWrite(target.note.absolutePath, target.backup!);
      restoredFiles.push(target.file.path);
    }
  }

  const graph = buildGraph(await loadVaultGraphInputs(vault));
  await saveGraphIndex(vault, graph);
  const registry = await readSourceRegistry(vault);
  const scan = await scanVaultChanges(vault, registry);
  await saveSourceRegistry(vault, scan.nextRegistry);
  const rollbackReceipt = { rolledBackReceiptId: receiptId, restoredFiles, removedCreatedFiles };
  const path = resolve(vault.realRoot, ".pir-acdm", "rollback-receipts", `${receiptId}.json`);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await atomicWrite(path, `${JSON.stringify(rollbackReceipt, null, 2)}\n`);
  return rollbackReceipt;
}

async function readReceipt(vault: ApprovedVault, receiptId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(receiptId)) throw new VaultToolError("ROLLBACK_NOT_FOUND", "invalid receipt id");
  try {
    const raw = await readFile(resolve(vault.realRoot, ".pir-acdm", "receipts", `${receiptId}.json`), "utf8");
    return receiptSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof VaultToolError) throw error;
    throw new VaultToolError("ROLLBACK_NOT_FOUND", "receipt is unavailable");
  }
}

async function readOptionalBuffer(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch (error) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function atomicWrite(path: string, content: string | Buffer): Promise<void> {
  await writeFileAtomic(path, content, { mode: 0o600, fsync: true });
}

function hash(content: string | Buffer | null): string | null {
  return content === null ? null : createHash("sha256").update(content).digest("hex");
}

const MANAGED_EXTENSIONS = new Set([".md", ".txt", ".docx", ".xlsx", ".pptx", ".pdf", ".png", ".jpg", ".jpeg", ".wav", ".m4a", ".mp3"]);

async function resolveReceiptTarget(vault: ApprovedVault, path: string): Promise<{ absolutePath: string }> {
  if (extname(path).toLowerCase() === ".md") return resolveNotePath(vault, path);
  const portable = path.replaceAll("\\", "/");
  if (!portable || portable.startsWith("/") || portable.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new VaultToolError("ROLLBACK_CONFLICT", "invalid receipt target");
  }
  if (!MANAGED_EXTENSIONS.has(extname(portable).toLowerCase()) || [".obsidian", ".pir-acdm", ".git"].includes(portable.split("/")[0]!)) {
    throw new VaultToolError("ROLLBACK_CONFLICT", "unsupported receipt target");
  }
  const absolutePath = resolve(vault.realRoot, ...portable.split("/"));
  const rel = relative(vault.realRoot, absolutePath);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new VaultToolError("ROLLBACK_CONFLICT", "receipt target escapes Vault");
  return { absolutePath };
}
