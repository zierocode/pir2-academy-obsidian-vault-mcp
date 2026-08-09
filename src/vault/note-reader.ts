import { readFile } from "node:fs/promises";
import { VaultToolError } from "../errors.js";
import { resolveNotePath } from "./note-path.js";
import type { ApprovedVault } from "./vault-root.js";

export const MAX_READ_NOTES = 20;
export const MAX_READ_BYTES = 200_000;

export type ReadNote = {
  path: string;
  content: string;
};

export type ReadNotesResult = {
  notes: ReadNote[];
};

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export async function readNotes(vault: ApprovedVault, paths: string[]): Promise<ReadNotesResult> {
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > MAX_READ_NOTES) {
    throw new VaultToolError("INVALID_NOTE_PATH", "เลือกโน้ตได้ครั้งละ 1 ถึง 20 ไฟล์เท่านั้น");
  }

  let totalBytes = 0;
  const notes: ReadNote[] = [];
  for (const path of paths) {
    const note = await resolveNotePath(vault, path);
    let content: string;
    try {
      content = await readFile(note.absolutePath, "utf8");
    } catch (error) {
      if (isMissing(error)) throw new VaultToolError("NOTE_NOT_FOUND", "ไม่พบโน้ตที่ระบุใน Obsidian Vault");
      throw new VaultToolError("VAULT_NOT_READY", "ไม่สามารถอ่านโน้ตจาก Obsidian Vault ได้");
    }

    totalBytes += Buffer.byteLength(content, "utf8");
    if (totalBytes > MAX_READ_BYTES) {
      throw new VaultToolError("INVALID_NOTE_PATH", "เนื้อหาโน้ตที่เลือกมีขนาดเกิน 200,000 bytes");
    }
    notes.push({ path: note.relativePath, content });
  }

  return { notes };
}
