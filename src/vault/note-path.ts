import { lstat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import { VaultToolError } from "../errors.js";
import type { ApprovedVault } from "./vault-root.js";

const DENIED_DIRECTORIES = new Set([".obsidian", ".pir-acdm", ".pir2-academy-backups"]);
const WINDOWS_RESERVED_DEVICE = /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])$/iu;
const WINDOWS_FORBIDDEN_CHARACTER = /[<>:"|?*]/u;

export type ResolvedNotePath = {
  absolutePath: string;
  relativePath: string;
};

function invalidPath(): VaultToolError {
  return new VaultToolError("INVALID_NOTE_PATH", "เส้นทางโน้ตไม่ปลอดภัยหรือไม่ใช่ไฟล์ Markdown");
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isUnsafeWindowsSegment(segment: string): boolean {
  const baseName = segment.split(".", 1)[0]!.replace(/[. ]+$/u, "");
  const hasControlCharacter = [...segment].some((character) => character.codePointAt(0)! <= 0x1f);
  return (
    segment.endsWith(".") ||
    segment.endsWith(" ") ||
    WINDOWS_FORBIDDEN_CHARACTER.test(segment) ||
    hasControlCharacter ||
    WINDOWS_RESERVED_DEVICE.test(baseName)
  );
}

function splitVaultPath(path: string, requireMarkdown: boolean): string[] {
  if (!path || isAbsolute(path) || win32.isAbsolute(path)) throw invalidPath();

  const segments = path.split(/[\\/]+/u);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..") ||
    segments.some((segment) => DENIED_DIRECTORIES.has(segment.toLowerCase())) ||
    segments.some(isUnsafeWindowsSegment) ||
    (requireMarkdown && !segments.at(-1)?.endsWith(".md"))
  ) {
    throw invalidPath();
  }

  return segments;
}

export function normalizeVaultFolderPath(folder: string): string {
  const normalized = folder.replaceAll("\\", "/").replace(/\/+$/u, "");
  return splitVaultPath(normalized, false).join("/");
}

export async function resolveNotePath(vault: ApprovedVault, notePath: string): Promise<ResolvedNotePath> {
  const segments = splitVaultPath(notePath, true);
  const absolutePath = resolve(vault.realRoot, ...segments);
  const insideRoot = relative(vault.realRoot, absolutePath);

  if (!insideRoot || insideRoot === ".." || insideRoot.startsWith(`..${sep}`) || isAbsolute(insideRoot)) {
    throw invalidPath();
  }

  let currentPath = vault.realRoot;
  for (const [index, segment] of segments.entries()) {
    currentPath = join(currentPath, segment);
    try {
      const details = await lstat(currentPath);
      if (details.isSymbolicLink() || (index < segments.length - 1 && !details.isDirectory())) throw invalidPath();
      if (index === segments.length - 1 && !details.isFile()) throw invalidPath();
    } catch (error) {
      if (error instanceof VaultToolError) throw error;
      if (isMissing(error)) break;
      throw invalidPath();
    }
  }

  return { absolutePath, relativePath: segments.join("/") };
}
