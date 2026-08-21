import { toolDescription } from "../contracts.js";
import { VaultToolError } from "../errors.js";
import { auditGraph } from "../graph/audit.js";
import { readGraphIndex } from "../graph/graph-store.js";
import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";

const inputSchema = z.object({ mode: z.enum(["quick", "full"]).default("quick") }).strict();

export function createAuditGraphTool(): UnboundToolDefinition {
  return {
    name: "audit_obsidian_graph",
    description: toolDescription("audit_obsidian_graph"),
    inputSchema,
    handler: async (_input, context) => {
      const stored = await readGraphIndex(context.services.vault);
      if (stored.status !== "ready") throw new VaultToolError("GRAPH_UNINITIALIZED", "graph is unavailable");
      const audit = auditGraph(stored.index);
      return context.success("ตรวจสุขภาพ Knowledge Graph แล้วครับ", {
        healthy: audit.healthy,
        issues: audit.issues,
        counts: { nodes: stored.index.nodes.length, edges: stored.index.edges.length, issues: audit.issues.length },
        repair_available: !audit.healthy
      });
    }
  };
}
