import { toolDescription } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { rollbackKnowledgeChange } from "../vault/rollback.js";
import { z } from "zod";

const inputSchema = z.object({
  receipt_id: z.string().min(1).max(128),
  confirmation: z.string().min(1).max(64)
}).strict();

export function createRollbackChangeTool(): UnboundToolDefinition {
  return {
    name: "rollback_obsidian_change",
    description: toolDescription("rollback_obsidian_change"),
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const receipt = await rollbackKnowledgeChange(context.services.vault, values.receipt_id, values.confirmation);
      return context.success("ย้อนคืนรายการเปลี่ยนแปลงสำเร็จแล้วครับ", {
        rolled_back_receipt_id: receipt.rolledBackReceiptId,
        restored_files: receipt.restoredFiles,
        removed_created_files: receipt.removedCreatedFiles
      });
    }
  };
}
