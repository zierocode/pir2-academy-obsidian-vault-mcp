import { toolDescription } from "../contracts.js";
import type { ToolExecutionContext, UnboundToolDefinition } from "../server.js";
import { createKnowledgeWriter } from "../vault/knowledge-writer.js";
import { z } from "zod";

const inputSchema = z.object({
  preview_id: z.string().min(1).max(128),
  confirmation: z.string().min(1).max(64)
}).strict();

export function createApplyKnowledgeBuildTool(): UnboundToolDefinition {
  return {
    name: "apply_obsidian_knowledge_build",
    description: toolDescription("apply_obsidian_knowledge_build"),
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const receipt = await writer(context).applyBuild(values.preview_id, values.confirmation);
      return context.success("สร้างหรือรีเฟรช Knowledge Graph สำเร็จแล้วครับ", {
        receipt_id: receipt.receiptId,
        changed_files: receipt.changedFiles,
        backup_paths: receipt.backupPaths,
        graph: receipt.graph
      });
    }
  };
}

function writer(context: ToolExecutionContext) {
  context.services.knowledgeWriter ??= createKnowledgeWriter({ vault: context.services.vault });
  return context.services.knowledgeWriter;
}
