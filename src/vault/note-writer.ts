import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { VaultToolError } from "../errors.js";
import { resolveNotePath } from "./note-path.js";
import type { ApprovedVault } from "./vault-root.js";
import { WritePreviewStore, type WriteMode, type WritePreview } from "./write-preview-store.js";

const PREVIEW_TTL_MS = 10 * 60 * 1000;
const BACKUP_DIRECTORY = ".pir2-academy-backups";
const CONFIRMATIONS = new Set(["ยืนยันบันทึก", "Confirm write"]);

export type PreviewWriteInput = {
  path: string;
  content: string;
  mode: WriteMode;
};

export type WriteReceipt = {
  notePath: string;
  beforeHash: string | null;
  proposedHash: string;
  backupPath?: string;
};

export type AtomicWrite = (path: string, content: string) => Promise<void>;

export type NoteWriterOptions = {
  vault: ApprovedVault;
  now?: () => number;
  previewId?: () => string;
  atomicWrite?: AtomicWrite;
  previews?: WritePreviewStore;
};

export type NoteWriter = {
  previewWrite(input: PreviewWriteInput): Promise<WritePreview>;
  applyWrite(previewId: string, confirmation: string): Promise<WriteReceipt>;
};

function hash(content: string | null): string | null {
  return content === null ? null : createHash("sha256").update(content, "utf8").digest("hex");
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function readCurrent(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw new VaultToolError("VAULT_NOT_READY", "ไม่สามารถอ่านโน้ตจาก Obsidian Vault ได้");
  }
}

function backupTimestamp(now: number): string {
  return new Date(now).toISOString().replace(/[.:-]/gu, "");
}

async function ensureDirectory(path: string): Promise<void> {
  try {
    await mkdir(path);
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST")) throw error;
  }
  const details = await lstat(path);
  if (!details.isDirectory() || details.isSymbolicLink()) {
    throw new VaultToolError("VAULT_NOT_READY", "ไม่สามารถสร้างข้อมูลสำรองของโน้ตได้อย่างปลอดภัย");
  }
}

async function writeBackup(vault: ApprovedVault, preview: WritePreview, content: string, now: number): Promise<string> {
  const timestamp = backupTimestamp(now);
  const backupRoot = resolve(vault.realRoot, BACKUP_DIRECTORY);
  const backupDirectory = join(backupRoot, timestamp);
  const backupPath = resolve(backupDirectory, ...preview.notePath.split("/"));
  const relativeBackup = relative(vault.realRoot, backupPath).split(sep).join("/");

  if (!relativeBackup.startsWith(`${BACKUP_DIRECTORY}/`) || relativeBackup.includes("../")) {
    throw new VaultToolError("VAULT_NOT_READY", "ไม่สามารถสร้างข้อมูลสำรองของโน้ตได้อย่างปลอดภัย");
  }

  await ensureDirectory(backupRoot);
  await ensureDirectory(backupDirectory);
  let parent = backupDirectory;
  for (const segment of preview.notePath.split("/").slice(0, -1)) {
    parent = join(parent, segment);
    await ensureDirectory(parent);
  }
  await writeFile(backupPath, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return relativeBackup;
}

async function defaultAtomicWrite(path: string, content: string): Promise<void> {
  await writeFileAtomic(path, content, { encoding: "utf8", mode: 0o600, fsync: true });
}

export function createNoteWriter(options: NoteWriterOptions): NoteWriter {
  const now = options.now ?? Date.now;
  const nextPreviewId = options.previewId ?? randomUUID;
  const writeAtomically = options.atomicWrite ?? defaultAtomicWrite;
  const previews = options.previews ?? new WritePreviewStore();

  return {
    async previewWrite(input: PreviewWriteInput): Promise<WritePreview> {
      const note = await resolveNotePath(options.vault, input.path);
      const current = await readCurrent(note.absolutePath);
      if (input.mode === "create" && current !== null) {
        throw new VaultToolError("WRITE_CONFLICT", "มีโน้ตนี้อยู่แล้ว โปรดตรวจตัวอย่างใหม่ก่อนบันทึก");
      }
      if (input.mode === "replace" && current === null) {
        throw new VaultToolError("NOTE_NOT_FOUND", "ไม่พบโน้ตที่ต้องการแทนที่");
      }

      const createdAt = now();
      const preview: WritePreview = {
        previewId: nextPreviewId(),
        notePath: note.relativePath,
        mode: input.mode,
        beforeHash: hash(current),
        proposedHash: hash(input.content) ?? "",
        proposedContent: input.content,
        expiresAt: createdAt + PREVIEW_TTL_MS
      };
      previews.put(preview, createdAt);
      return preview;
    },

    async applyWrite(previewId: string, confirmation: string): Promise<WriteReceipt> {
      if (!previews.get(previewId)) throw new VaultToolError("WRITE_PREVIEW_REQUIRED", "กรุณาสร้างตัวอย่างก่อนบันทึกโน้ต");
      if (!CONFIRMATIONS.has(confirmation)) {
        throw new VaultToolError("WRITE_NOT_CONFIRMED", "โปรดยืนยันด้วย ยืนยันบันทึก หรือ Confirm write");
      }
      const preview = previews.take(previewId);
      if (!preview) throw new VaultToolError("WRITE_PREVIEW_REQUIRED", "กรุณาสร้างตัวอย่างก่อนบันทึกโน้ต");
      if (now() > preview.expiresAt) {
        throw new VaultToolError("WRITE_PREVIEW_EXPIRED", "ตัวอย่างหมดอายุแล้ว โปรดสร้างตัวอย่างใหม่");
      }

      const note = await resolveNotePath(options.vault, preview.notePath);
      const current = await readCurrent(note.absolutePath);
      if (hash(current) !== preview.beforeHash) {
        throw new VaultToolError("WRITE_CONFLICT", "เนื้อหาโน้ตเปลี่ยนหลังสร้างตัวอย่าง โปรดตรวจตัวอย่างใหม่");
      }

      try {
        const backupPath = current === null ? undefined : await writeBackup(options.vault, preview, current, now());
        await writeAtomically(note.absolutePath, preview.proposedContent);
        return {
          notePath: preview.notePath,
          beforeHash: preview.beforeHash,
          proposedHash: preview.proposedHash,
          ...(backupPath ? { backupPath } : {})
        };
      } catch (error) {
        if (error instanceof VaultToolError) throw error;
        throw new VaultToolError("VAULT_NOT_READY", "บันทึกโน้ตไม่สำเร็จและไฟล์เดิมยังคงอยู่");
      }
    }
  };
}
