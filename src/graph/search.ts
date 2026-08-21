import type { GraphIndex } from "./types.js";
import { traverseGraph } from "./traversal.js";

export type DirectMatch = {
  path: string;
  matchKind: "keyword";
  depth: 0;
  viaPath: [string];
};

export type SearchDiscovery = {
  path: string;
  matchKind: "outgoing_link" | "backlink";
  edgeDirection: "outgoing" | "backlink";
  relation: string;
  depth: number;
  viaPath: string[];
};

export function searchGraph(
  graph: GraphIndex,
  seedPaths: readonly string[],
  options: { maxDepth: number; limit: number }
): { directMatches: DirectMatch[]; graphDiscoveries: SearchDiscovery[]; fallbackReason?: "no_usable_edges" } {
  const known = new Set(graph.nodes.map((node) => node.path));
  const seeds = [...new Set(seedPaths)].filter((path) => known.has(path));
  const directMatches: DirectMatch[] = seeds.map((path) => ({
    path,
    matchKind: "keyword",
    depth: 0,
    viaPath: [path]
  }));
  const graphDiscoveries = traverseGraph(graph, seeds, {
    direction: "both",
    maxDepth: options.maxDepth,
    limit: Math.max(0, options.limit - directMatches.length)
  }).map((item): SearchDiscovery => ({
    path: item.path,
    matchKind: item.edgeDirection === "outgoing" ? "outgoing_link" : "backlink",
    edgeDirection: item.edgeDirection,
    relation: item.relation,
    depth: item.depth,
    viaPath: item.viaPath
  }));

  return {
    directMatches,
    graphDiscoveries,
    ...(graphDiscoveries.length === 0 ? { fallbackReason: "no_usable_edges" as const } : {})
  };
}
