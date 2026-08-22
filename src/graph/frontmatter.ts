import { parseDocument } from "yaml";
import type { GraphPropertyValue } from "./types.js";

export type ParsedFrontmatter = {
  properties: Record<string, GraphPropertyValue>;
  body: string;
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u;

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = FRONTMATTER.exec(content);
  if (!match) return { properties: {}, body: content };

  try {
    const safeSource = match[1]!
      .split(/\r?\n/u)
      .filter((line) => !/!{1,2}(?:<|[a-z])/iu.test(line))
      .join("\n");
    const document = parseDocument(safeSource, {
      schema: "core",
      prettyErrors: false
    });
    if (document.errors.length > 0) return { properties: {}, body: content };
    const value = document.toJS({ maxAliasCount: 0 });
    if (!isRecord(value)) return { properties: {}, body: content };

    const properties: Record<string, GraphPropertyValue> = {};
    for (const [key, raw] of Object.entries(value)) {
      const normalized = normalizeProperty(raw);
      if (normalized !== undefined) properties[key] = normalized;
    }
    return { properties, body: content.slice(match[0].length) };
  } catch {
    return { properties: {}, body: content };
  }
}

function normalizeProperty(value: unknown): GraphPropertyValue | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((entry) => ["string", "number", "boolean"].includes(typeof entry))) {
    return value.map(String);
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
