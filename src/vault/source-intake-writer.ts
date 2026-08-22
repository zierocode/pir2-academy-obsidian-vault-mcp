import { constants } from "node:fs";
import { copyFile, mkdir, readFile, stat, unlink } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { randomUUID } from "node:crypto";
import { VaultToolError } from "../errors.js";
import { auditGraph } from "../graph/audit.js";
import { buildGraph } from "../graph/graph-builder.js";
import type { SourceHandle, SourceInspector } from "../source/source-inspector.js";
import { createKnowledgeWriter, loadVaultGraphInputs, type KnowledgeBuildInput, type KnowledgePreview, type KnowledgeWriter } from "./knowledge-writer.js";
import { readSourceRegistry, saveSourceRegistry } from "./source-registry.js";
import { scanVaultChanges } from "./change-scanner.js";
import type { ApprovedVault } from "./vault-root.js";
import { rollbackKnowledgeChange } from "./rollback.js";

const TTL_MS = 10 * 60 * 1000;
const CONFIRMATIONS = new Set(["ยืนยันนำเข้า", "Confirm import"]);

export type SourceIntakeInput = {
  sources: Array<{ sourceId: string; destination: string; project?: string }>;
  notes: KnowledgeBuildInput["notes"];
  managedLinks: KnowledgeBuildInput["managedLinks"];
};

type PlannedSource = { handle: SourceHandle; destination: string; copy: boolean; project?: string };
type Preview = {
  id: string;
  sources: PlannedSource[];
  knowledge: KnowledgePreview;
  graph: { nodes: number; edges: number; healthy: boolean; issues: number };
  expiresAt: number;
};

export type SourceIntakeWriter = {
  preview(input: SourceIntakeInput): Promise<Preview>;
  apply(previewId: string, confirmation: string): Promise<{
    receiptId: string;
    copiedSources: string[];
    registeredSources: string[];
    generatedNotes: string[];
    graph: { nodes: number; edges: number; healthy: boolean; issues: number };
  }>;
};

export function createSourceIntakeWriter(options: {
  vault: ApprovedVault;
  inspector: SourceInspector;
  knowledgeWriter?: KnowledgeWriter;
  now?: () => number;
}): SourceIntakeWriter {
  const previews = new Map<string, Preview>();
  const now = options.now ?? Date.now;
  const knowledgeWriter = options.knowledgeWriter ?? createKnowledgeWriter({ vault: options.vault });
  return {
    async preview(input) {
      const sources: PlannedSource[] = [];
      for (const proposal of input.sources) {
        const handle = await options.inspector.get(proposal.sourceId);
        const destination = handle.origin === "vault"
          ? portable(relative(options.vault.realRoot, handle.absolutePath))
          : validateDestination(options.vault, proposal.destination, handle.name);
        if (sources.some((source) => source.destination === destination)) {
          throw new VaultToolError("SOURCE_COPY_CONFLICT", "duplicate destination");
        }
        if (handle.origin === "external" && await exists(resolve(options.vault.realRoot, ...destination.split("/")))) {
          throw new VaultToolError("SOURCE_COPY_CONFLICT", "destination exists");
        }
        sources.push({ handle, destination, copy: handle.origin === "external", ...(proposal.project ? { project: proposal.project } : {}) });
      }
      const knowledge = await knowledgeWriter.previewBuild({ mode: "refresh", notes: input.notes, managedLinks: input.managedLinks });
      const graphInputs = await loadVaultGraphInputs(options.vault);
      const byPath = new Map(graphInputs.map((entry) => [entry.path, entry]));
      for (const source of sources) byPath.set(source.destination, { path: source.destination, content: "" });
      for (const note of knowledge.files) byPath.set(note.path, { path: note.path, content: note.proposedContent });
      const predicted = buildGraph([...byPath.values()]);
      const audit = auditGraph(predicted);
      const preview = {
        id: randomUUID(),
        sources,
        knowledge,
        graph: { nodes: predicted.nodes.length, edges: predicted.edges.length, healthy: audit.healthy, issues: audit.issues.length },
        expiresAt: now() + TTL_MS
      };
      previews.set(preview.id, preview);
      return preview;
    },
    async apply(previewId, confirmation) {
      const preview = previews.get(previewId);
      if (!preview) throw new VaultToolError("SOURCE_PREVIEW_REQUIRED", "source preview required");
      if (!CONFIRMATIONS.has(confirmation)) throw new VaultToolError("WRITE_NOT_CONFIRMED", "exact import confirmation required");
      previews.delete(previewId);
      if (now() > preview.expiresAt) throw new VaultToolError("SOURCE_PREVIEW_EXPIRED", "source preview expired");
      for (const source of preview.sources) await options.inspector.get(source.handle.sourceId);

      const copied: Array<{ path: string; absolutePath: string; hash: string }> = [];
      let appliedReceiptId: string | undefined;
      try {
        for (const source of preview.sources.filter((item) => item.copy)) {
          const target = resolve(options.vault.realRoot, ...source.destination.split("/"));
          await mkdir(dirname(target), { recursive: true, mode: 0o700 });
          await copyFile(source.handle.absolutePath, target, constants.COPYFILE_EXCL);
          copied.push({ path: source.destination, absolutePath: target, hash: source.handle.sha256 });
        }
        const knowledgeReceipt = await knowledgeWriter.applyBuild(preview.knowledge.previewId, "ยืนยันบันทึก");
        appliedReceiptId = knowledgeReceipt.receiptId;
        const registry = await readSourceRegistry(options.vault);
        const scan = await scanVaultChanges(options.vault, registry, now);
        for (const source of preview.sources) {
          const record = scan.nextRegistry.records.find((candidate) => candidate.path === source.destination);
          if (!record) continue;
          record.projectLinks = source.project ? [source.project] : [];
          record.generatedNoteLinks = preview.knowledge.files.map((file) => file.path);
        }
        await saveSourceRegistry(options.vault, scan.nextRegistry);
        await extendReceipt(options.vault, knowledgeReceipt.receiptId, copied);
        return {
          receiptId: knowledgeReceipt.receiptId,
          copiedSources: copied.map((item) => item.path),
          registeredSources: preview.sources.map((item) => item.destination),
          generatedNotes: knowledgeReceipt.changedFiles,
          graph: knowledgeReceipt.graph
        };
      } catch (error) {
        if (appliedReceiptId) {
          await rollbackKnowledgeChange(options.vault, appliedReceiptId, "ยืนยันบันทึก").catch(() => undefined);
        }
        await Promise.all(copied.map((item) => unlink(item.absolutePath).catch(() => undefined)));
        if (error instanceof VaultToolError) throw error;
        throw new VaultToolError("SOURCE_COPY_CONFLICT", "source intake restored after failure");
      }
    }
  };
}

function validateDestination(vault: ApprovedVault, destination: string, sourceName: string): string {
  const portablePath = destination.replaceAll("\\", "/").replace(/^\.\//, "");
  if (!portablePath || portablePath.startsWith("/") || portablePath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new VaultToolError("SOURCE_COPY_CONFLICT", "invalid destination");
  }
  if ([".obsidian", ".pir-acdm", ".git"].includes(portablePath.split("/")[0]!)) {
    throw new VaultToolError("SOURCE_COPY_CONFLICT", "protected destination");
  }
  if (extname(portablePath).toLowerCase() !== extname(sourceName).toLowerCase()) {
    throw new VaultToolError("SOURCE_COPY_CONFLICT", "destination extension mismatch");
  }
  const absolute = resolve(vault.realRoot, ...portablePath.split("/"));
  const rel = relative(vault.realRoot, absolute);
  if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) throw new VaultToolError("SOURCE_COPY_CONFLICT", "destination escapes Vault");
  return portablePath;
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

async function extendReceipt(vault: ApprovedVault, receiptId: string, copied: Array<{ path: string; hash: string }>): Promise<void> {
  const receiptPath = resolve(vault.realRoot, ".pir-acdm", "receipts", `${receiptId}.json`);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as { files: unknown[] };
  receipt.files.unshift(...copied.map((source) => ({ path: source.path, beforeHash: null, proposedHash: source.hash })));
  await writeFileAtomic(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", mode: 0o600, fsync: true });
}

function portable(path: string): string {
  return path.split(sep).join("/");
}
