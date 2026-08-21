import { createHash } from "node:crypto";
import { posix } from "node:path";
import { VaultToolError } from "../errors.js";
import { parseFrontmatter } from "./frontmatter.js";
import type { GraphEdge, GraphIndex, GraphNode, GraphPropertyValue } from "./types.js";
import { parseWikiLinks, type WikiLink } from "./wikilinks.js";

const MAX_NODES = 10_000;
const MAX_EDGES = 50_000;

export type GraphInput = { path: string; content: string };

export function buildGraph(inputs: readonly GraphInput[]): GraphIndex {
  if (inputs.length > MAX_NODES) throw limitError();

  const parsed = inputs.map((input) => {
    const path = normalizeGraphPath(input.path);
    const frontmatter = parseFrontmatter(input.content);
    const aliases = propertyValues(frontmatter.properties.aliases);
    return {
      path,
      content: input.content,
      properties: frontmatter.properties,
      body: frontmatter.body,
      aliases
    };
  }).sort((left, right) => left.path.localeCompare(right.path));

  const nodes: GraphNode[] = parsed.map((note) => ({
    id: propertyValues(note.properties.id)[0] ?? note.path,
    path: note.path,
    title: posix.basename(note.path, posix.extname(note.path)),
    aliases: note.aliases,
    properties: note.properties,
    contentHash: createHash("sha256").update(note.content).digest("hex")
  }));
  const paths = new Set(nodes.map((node) => node.path));
  const basenameMap = groupBy(nodes, (node) => node.title);
  const aliasMap = groupBy(nodes.flatMap((node) => node.aliases.map((alias) => ({ ...node, alias }))), (node) => node.alias);
  const edges: GraphEdge[] = [];

  for (const note of parsed) {
    for (const [relation, value] of Object.entries(note.properties)) {
      if (relation === "aliases" || relation === "id") continue;
      for (const entry of propertyValues(value)) {
        for (const link of parseWikiLinks(entry)) {
          edges.push(resolveEdge(note.path, link, "property", relation, paths, basenameMap, aliasMap));
        }
      }
    }
    for (const link of parseWikiLinks(note.body)) {
      edges.push(resolveEdge(
        note.path,
        link,
        link.embed ? "embed" : "wikilink",
        link.embed ? "embeds" : "links_to",
        paths,
        basenameMap,
        aliasMap
      ));
    }
    if (edges.length > MAX_EDGES) throw limitError();
  }

  const outgoing = adjacency(nodes, edges, "outgoing");
  const backlinks = adjacency(nodes, edges, "backlinks");
  return { schemaVersion: 1, nodes, edges, outgoing, backlinks };
}

function resolveEdge(
  from: string,
  link: WikiLink,
  kind: GraphEdge["kind"],
  relation: string,
  paths: Set<string>,
  basenameMap: Map<string, GraphNode[]>,
  aliasMap: Map<string, Array<GraphNode & { alias: string }>>
): GraphEdge {
  const resolution = resolveTarget(from, link.target, paths, basenameMap, aliasMap);
  return {
    from,
    to: resolution.path,
    rawTarget: link.rawTarget,
    kind,
    relation,
    unresolved: resolution.path === null,
    resolution: resolution.kind
  };
}

function resolveTarget(
  from: string,
  rawTarget: string,
  paths: Set<string>,
  basenameMap: Map<string, GraphNode[]>,
  aliasMap: Map<string, Array<GraphNode & { alias: string }>>
): { path: string | null; kind: GraphEdge["resolution"] } {
  const target = rawTarget.replaceAll("\\", "/").replace(/^\/+/, "");
  const withExtension = posix.extname(target) ? target : `${target}.md`;
  const relative = posix.normalize(posix.join(posix.dirname(from), withExtension));
  if (!relative.startsWith("../") && paths.has(relative)) return { path: relative, kind: "relative" };
  const vault = posix.normalize(withExtension);
  if (!vault.startsWith("../") && paths.has(vault)) return { path: vault, kind: "vault" };

  const title = posix.basename(target, posix.extname(target));
  const basename = basenameMap.get(title) ?? [];
  if (basename.length === 1) return { path: basename[0]!.path, kind: "basename" };
  if (basename.length > 1) return { path: null, kind: "ambiguous" };
  const aliases = aliasMap.get(target) ?? [];
  if (aliases.length === 1) return { path: aliases[0]!.path, kind: "alias" };
  if (aliases.length > 1) return { path: null, kind: "ambiguous" };
  return { path: null, kind: "missing" };
}

function adjacency(nodes: readonly GraphNode[], edges: readonly GraphEdge[], mode: "outgoing" | "backlinks"): Record<string, string[]> {
  const result = Object.fromEntries(nodes.map((node) => [node.path, [] as string[]]));
  for (const edge of edges) {
    if (!edge.to) continue;
    const key = mode === "outgoing" ? edge.from : edge.to;
    const value = mode === "outgoing" ? edge.to : edge.from;
    if (!result[key]!.includes(value)) result[key]!.push(value);
  }
  for (const values of Object.values(result)) values.sort((left, right) => left.localeCompare(right));
  return result;
}

function groupBy<T>(values: readonly T[], key: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) result.set(key(value), [...(result.get(key(value)) ?? []), value]);
  return result;
}

function propertyValues(value: GraphPropertyValue | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeGraphPath(path: string): string {
  const normalized = posix.normalize(path.replaceAll("\\", "/").replace(/^\.\//u, ""));
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || posix.isAbsolute(normalized)) {
    throw new VaultToolError("INVALID_NOTE_PATH", "invalid graph path");
  }
  return normalized;
}

function limitError(): VaultToolError {
  return new VaultToolError("GRAPH_LIMIT_EXCEEDED", "graph limit exceeded");
}
