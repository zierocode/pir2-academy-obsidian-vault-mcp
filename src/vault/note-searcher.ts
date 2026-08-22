import { lstat, opendir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { VaultToolError } from "../errors.js";
import { normalizeVaultFolderPath } from "./note-path.js";
import type { ApprovedVault } from "./vault-root.js";

const DENIED_DIRECTORIES = new Set([".obsidian", ".pir2-academy-backups"]);
const MAX_INDEXED_NOTES = 10_000;
const MAX_SEARCH_FILE_BYTES = 2_000_000;

export type SearchNotesInput = {
  query: string;
  folder?: string;
  limit: number;
};

async function resolveSearchRoot(vault: ApprovedVault, folder?: string): Promise<{ absolute: string; prefix: string }> {
  if (!folder) return { absolute: vault.realRoot, prefix: "" };

  const normalized = normalizeVaultFolderPath(folder);
  let current = vault.realRoot;
  for (const segment of normalized.split("/")) {
    current = join(current, segment);
    try {
      const details = await lstat(current);
      if (details.isSymbolicLink() || !details.isDirectory()) throw new Error("unsafe search folder");
    } catch {
      throw new VaultToolError("INVALID_NOTE_PATH", "โฟลเดอร์ค้นหาไม่ปลอดภัยหรือไม่มีอยู่ใน Vault");
    }
  }
  return { absolute: resolve(current), prefix: normalized };
}

async function listMarkdownNotes(absoluteRoot: string, prefix: string): Promise<string[]> {
  const results: string[] = [];
  const pending = [{ absolute: absoluteRoot, relative: prefix }];

  while (pending.length > 0) {
    const directory = pending.pop()!;
    const handle = await opendir(directory.absolute);
    for await (const entry of handle) {
      if (entry.isSymbolicLink()) continue;
      const relativePath = directory.relative ? `${directory.relative}/${entry.name}` : entry.name;
      const absolutePath = join(directory.absolute, entry.name);
      if (entry.isDirectory()) {
        if (!DENIED_DIRECTORIES.has(entry.name.toLowerCase())) {
          pending.push({ absolute: absolutePath, relative: relativePath });
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        results.push(relativePath);
        if (results.length > MAX_INDEXED_NOTES) {
          throw new VaultToolError("VAULT_NOT_READY", "Vault มีโน้ตมากเกินขอบเขตการค้นหาที่ปลอดภัย");
        }
      }
    }
  }

  return results.sort((a, b) => a.localeCompare(b, "th"));
}

export async function searchNotesDirect(vault: ApprovedVault, input: SearchNotesInput): Promise<string[]> {
  const searchRoot = await resolveSearchRoot(vault, input.folder);
  const candidates = await listMarkdownNotes(searchRoot.absolute, searchRoot.prefix);
  const query = input.query.toLocaleLowerCase("th");
  const matches: string[] = [];

  for (const relativePath of candidates) {
    if (relativePath.toLocaleLowerCase("th").includes(query)) {
      matches.push(relativePath);
    } else {
      const absolutePath = join(vault.realRoot, ...relativePath.split("/"));
      const details = await lstat(absolutePath);
      if (details.size <= MAX_SEARCH_FILE_BYTES) {
        const content = await readFile(absolutePath, "utf8");
        if (content.toLocaleLowerCase("th").includes(query)) matches.push(relativePath);
      }
    }
    if (matches.length >= input.limit) break;
  }

  return matches;
}
