import type { GraphEdge, GraphIndex } from "./types.js";

export type TraversalDirection = "outgoing" | "backlinks" | "both";

export type GraphDiscovery = {
  path: string;
  depth: number;
  edgeDirection: "outgoing" | "backlink";
  relation: string;
  viaPath: string[];
};

export function traverseGraph(
  graph: GraphIndex,
  seeds: readonly string[],
  options: { direction: TraversalDirection; maxDepth: number; limit: number }
): GraphDiscovery[] {
  const seedSet = new Set(seeds);
  const visited = new Set(seeds);
  const queue = seeds.map((path) => ({ path, depth: 0, viaPath: [path] }));
  const results: GraphDiscovery[] = [];

  while (queue.length > 0 && results.length < options.limit) {
    const current = queue.shift()!;
    if (current.depth >= options.maxDepth) continue;
    for (const candidate of neighbors(graph.edges, current.path, options.direction)) {
      if (visited.has(candidate.path)) continue;
      visited.add(candidate.path);
      const discovery: GraphDiscovery = {
        path: candidate.path,
        depth: current.depth + 1,
        edgeDirection: candidate.edgeDirection,
        relation: candidate.edge.relation,
        viaPath: [...current.viaPath, candidate.path]
      };
      queue.push({ path: candidate.path, depth: discovery.depth, viaPath: discovery.viaPath });
      if (!seedSet.has(candidate.path)) results.push(discovery);
      if (results.length >= options.limit) break;
    }
  }
  return results;
}

function neighbors(
  edges: readonly GraphEdge[],
  path: string,
  direction: TraversalDirection
): Array<{ path: string; edgeDirection: "outgoing" | "backlink"; edge: GraphEdge }> {
  const result: Array<{ path: string; edgeDirection: "outgoing" | "backlink"; edge: GraphEdge }> = [];
  if (direction === "outgoing" || direction === "both") {
    for (const edge of edges) {
      if (edge.from === path && edge.to) result.push({ path: edge.to, edgeDirection: "outgoing", edge });
    }
  }
  if (direction === "backlinks" || direction === "both") {
    for (const edge of edges) {
      if (edge.to === path) result.push({ path: edge.from, edgeDirection: "backlink", edge });
    }
  }
  return result.sort((left, right) => left.path.localeCompare(right.path));
}
