import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import type { ApprovedVault } from "./vault-root.js";
import { normalizeIndexedPath, parseWikilinks, type ParsedWikilink } from "./wikilinks.js";

type IndexedNote = {
  path: string;
  content: string;
  links: ParsedWikilink[];
};

export type IndexedOutgoingLink = { raw: string; target: string; resolved_path?: string };
export type IndexedBacklink = { source_path: string; raw: string };
export type NoteSearchResult = { path: string; excerpt: string };

const DENIED_DIRECTORIES = new Set([".obsidian", ".pir2-academy-backups", ".git", "node_modules"]);

function noteKey(path: string): string {
  return normalizeIndexedPath(path).replace(/\.md$/iu, "").toLocaleLowerCase();
}

async function findMarkdownFiles(root: string, current = root): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && !DENIED_DIRECTORIES.has(entry.name.toLocaleLowerCase())) {
        found.push(...(await findMarkdownFiles(root, absolute)));
      }
    } else if (entry.isFile() && extname(entry.name).toLocaleLowerCase() === ".md") {
      found.push(normalizeIndexedPath(relative(root, absolute)));
    }
  }

  return found;
}

function excerptFor(content: string, query: string): string {
  const normalized = content.toLocaleLowerCase();
  const at = normalized.indexOf(query.toLocaleLowerCase());
  const start = Math.max(0, at - 60);
  const end = Math.min(content.length, at + query.length + 100);
  return content.slice(start, end).replace(/\s+/gu, " ").trim();
}

export async function buildNoteIndex(vault: ApprovedVault) {
  const paths = (await findMarkdownFiles(vault.realRoot)).sort((left, right) => left.localeCompare(right, "en"));
  const notes = new Map<string, IndexedNote>();

  for (const path of paths) {
    const content = await readFile(join(vault.realRoot, ...path.split("/")), "utf8");
    notes.set(path, { path, content, links: parseWikilinks(content) });
  }

  const fullPathLookup = new Map<string, string>();
  const basenameLookup = new Map<string, string[]>();
  for (const path of paths) {
    fullPathLookup.set(noteKey(path), path);
    const key = noteKey(basename(path));
    basenameLookup.set(key, [...(basenameLookup.get(key) ?? []), path]);
  }

  function resolveTarget(target: string): string | undefined {
    const key = noteKey(target);
    const exact = fullPathLookup.get(key);
    if (exact) return exact;
    const matches = basenameLookup.get(noteKey(basename(target)));
    return matches?.length === 1 ? matches[0] : undefined;
  }

  const outgoingByPath = new Map<string, IndexedOutgoingLink[]>();
  const backlinksByPath = new Map<string, IndexedBacklink[]>();
  for (const note of notes.values()) {
    const outgoing = note.links.map((link): IndexedOutgoingLink => {
      const resolvedPath = resolveTarget(link.target);
      if (resolvedPath) {
        backlinksByPath.set(resolvedPath, [
          ...(backlinksByPath.get(resolvedPath) ?? []),
          { source_path: note.path, raw: link.raw }
        ]);
      }
      return { raw: link.raw, target: link.target, ...(resolvedPath ? { resolved_path: resolvedPath } : {}) };
    });
    outgoingByPath.set(note.path, outgoing);
  }

  return {
    paths,
    outgoing(path: string): IndexedOutgoingLink[] {
      return outgoingByPath.get(normalizeIndexedPath(path)) ?? [];
    },
    backlinks(path: string): IndexedBacklink[] {
      return backlinksByPath.get(normalizeIndexedPath(path)) ?? [];
    },
    unresolved(path: string): Array<{ raw: string; target: string }> {
      return (outgoingByPath.get(normalizeIndexedPath(path)) ?? [])
        .filter((link) => !link.resolved_path)
        .map(({ raw, target }) => ({ raw, target }));
    },
    search(query: string, options: { folder?: string; limit?: number } = {}): NoteSearchResult[] {
      const normalizedQuery = query.trim().toLocaleLowerCase();
      if (!normalizedQuery) return [];
      const folder = options.folder ? `${normalizeIndexedPath(options.folder)}/` : undefined;
      const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
      return paths
        .filter((path) => !folder || path.startsWith(folder))
        .filter((path) => notes.get(path)!.content.toLocaleLowerCase().includes(normalizedQuery))
        .slice(0, limit)
        .map((path) => ({ path, excerpt: excerptFor(notes.get(path)!.content, query) }));
    }
  };
}
