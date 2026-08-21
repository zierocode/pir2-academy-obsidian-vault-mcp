import { toolDescription } from "../contracts.js";
import { VaultToolError } from "../errors.js";
import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";

const auditSchema = z.object({
  mode: z.enum(["quick", "full"]).default("quick")
}).strict();

const rollbackSchema = z.object({
  receipt_id: z.string().min(1).max(128),
  confirmation: z.string().min(1).max(64)
}).strict();

export function createAuditGraphTool(): UnboundToolDefinition {
  return {
    name: "audit_obsidian_graph",
    description: toolDescription("audit_obsidian_graph"),
    inputSchema: auditSchema,
    handler: async (_input, context) => context.success("ตรวจสุขภาพกราฟเบื้องต้นแล้วครับ", {
      initialized: false,
      healthy: false,
      issues: [{ code: "GRAPH_UNINITIALIZED" }]
    })
  };
}

export function createRollbackChangeTool(): UnboundToolDefinition {
  return {
    name: "rollback_obsidian_change",
    description: toolDescription("rollback_obsidian_change"),
    inputSchema: rollbackSchema,
    handler: async () => {
      throw new VaultToolError("ROLLBACK_NOT_FOUND", "rollback receipt was not found");
    }
  };
}
