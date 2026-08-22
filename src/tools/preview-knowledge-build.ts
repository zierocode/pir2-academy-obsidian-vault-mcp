import { toolDescription } from "../contracts.js";
import type { ToolExecutionContext, UnboundToolDefinition } from "../server.js";
import { createKnowledgeWriter } from "../vault/knowledge-writer.js";
import { z } from "zod";

const inputSchema = z.object({
  mode: z.enum(["initialize", "refresh", "repair"]),
  notes: z.array(z.object({
    path: z.string().min(1).max(1_024),
    content: z.string().max(200_000),
    mode: z.enum(["create", "replace"])
  }).strict()).max(200).default([]),
  managed_links: z.array(z.object({
    from: z.string().min(1).max(1_024),
    to: z.string().min(1).max(1_024),
    relation: z.string().min(1).max(80)
  }).strict()).max(500).default([])
}).strict();

export function createPreviewKnowledgeBuildTool(): UnboundToolDefinition {
  return {
    name: "preview_obsidian_knowledge_build",
    description: toolDescription("preview_obsidian_knowledge_build"),
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const preview = await writer(context).previewBuild({
        mode: values.mode,
        notes: values.notes,
        managedLinks: values.managed_links
      });
      return context.success("สร้างตัวอย่าง Knowledge Graph แล้วครับ โปรดตรวจใน Canvas ก่อนยืนยัน", {
        preview_id: preview.previewId,
        mode: preview.mode,
        summary: {
          files: preview.fileCount,
          nodes: preview.nodeCount,
          edges: preview.edgeCount,
          healthy: preview.healthy,
          issues: preview.auditIssues.length
        },
        audit_issues: preview.auditIssues,
        files: preview.files.map((file) => ({
          path: file.path,
          before_hash: file.beforeHash,
          proposed_hash: file.proposedHash
        })),
        expires_at: preview.expiresAt
      });
    }
  };
}

function writer(context: ToolExecutionContext) {
  context.services.knowledgeWriter ??= createKnowledgeWriter({ vault: context.services.vault });
  return context.services.knowledgeWriter;
}
