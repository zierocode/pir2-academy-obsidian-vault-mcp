import { lstat, readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { VaultToolError } from "../errors.js";
import type { ApprovedVault } from "./vault-root.js";

const MAX_SCAN_ENTRIES = 10_000;
const MAX_NOTE_BYTES = 1_000_000;
const EXCLUDED_DIRECTORIES = new Set([".obsidian", ".pir2-academy-backups"]);

function portableRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

function insideVault(vault: ApprovedVault, path: string): boolean {
  const rel = portableRelative(vault.realRoot, path);
  return rel === "" || (!rel.startsWith("../") && rel !== "..");
}

export async function searchMarkdownNotes(
  vault: ApprovedVault,
  query: string,
  folder: string | undefined,
  limit: number
): Promise<string[]> {
  const start = folder ? resolve(vault.realRoot, ...folder.split("/")) : vault.realRoot;
  if (!insideVault(vault, start)) throw new VaultToolError("INVALID_NOTE_PATH", "โฟลเดอร์ค้นหาอยู่นอก Vault");

  const needle = query.trim().toLocaleLowerCase();
  const matches: string[] = [];
  const pending = [start];
  let scanned = 0;

  while (pending.length > 0 && matches.length < limit) {
    const directory = pending.pop()!;
    let entries;
    try {
      const details = await lstat(directory);
      if (!details.isDirectory() || details.isSymbolicLink()) continue;
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") continue;
      throw new VaultToolError("VAULT_NOT_READY", "ไม่สามารถค้นหาโน้ตใน Vault ได้");
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      scanned += 1;
      if (scanned > MAX_SCAN_ENTRIES) throw new VaultToolError("VAULT_NOT_READY", "Vault มีรายการมากเกินขอบเขตการค้นหาครั้งเดียว");
      const absolute = resolve(directory, entry.name);
      if (!insideVault(vault, absolute)) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".")) pending.push(absolute);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLocaleLowerCase().endsWith(".md")) continue;

      const notePath = portableRelative(vault.realRoot, absolute);
      if (notePath.toLocaleLowerCase().includes(needle)) {
        matches.push(notePath);
        if (matches.length >= limit) break;
        continue;
      }

      try {
        const details = await lstat(absolute);
        if (details.isSymbolicLink() || details.size > MAX_NOTE_BYTES) continue;
        const content = await readFile(absolute, "utf8");
        if (content.toLocaleLowerCase().includes(needle)) matches.push(notePath);
      } catch (error) {
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) {
          throw new VaultToolError("VAULT_NOT_READY", "ไม่สามารถค้นหาโน้ตใน Vault ได้");
        }
      }
      if (matches.length >= limit) break;
    }
  }

  return matches;
}
