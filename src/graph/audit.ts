import type { GraphIndex } from "./types.js";

export type GraphAuditIssue = {
  code: "UNRESOLVED_LINK" | "ORPHAN_NOTE" | "DUPLICATE_ID";
  path: string;
  detail: string;
};

export function auditGraph(graph: GraphIndex): { healthy: boolean; issues: GraphAuditIssue[] } {
  const issues: GraphAuditIssue[] = [];
  for (const edge of graph.edges) {
    if (edge.unresolved) issues.push({
      code: "UNRESOLVED_LINK",
      path: edge.from,
      detail: edge.rawTarget
    });
  }

  const firstById = new Map<string, string>();
  for (const node of graph.nodes) {
    const first = firstById.get(node.id);
    if (first) issues.push({ code: "DUPLICATE_ID", path: node.path, detail: first });
    else firstById.set(node.id, node.path);

    if (!isAuditExempt(node.path) && (graph.outgoing[node.path]?.length ?? 0) === 0 && (graph.backlinks[node.path]?.length ?? 0) === 0) {
      issues.push({ code: "ORPHAN_NOTE", path: node.path, detail: "no graph relationships" });
    }
  }
  issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return { healthy: issues.length === 0, issues };
}

function isAuditExempt(path: string): boolean {
  return path === "README.md";
}
