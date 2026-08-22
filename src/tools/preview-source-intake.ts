import { z } from "zod";
import { toolDescription } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { createSourceInspector } from "../source/source-inspector.js";
import { createSourceIntakeWriter } from "../vault/source-intake-writer.js";

const inputSchema = z.object({
  sources: z.array(z.object({
    source_id: z.string().min(1).max(128),
    destination: z.string().min(1).max(1_024),
    project: z.string().min(1).max(300).optional()
  }).strict()).max(20),
  notes: z.array(z.object({
    path: z.string().min(1).max(1_024),
    content: z.string().max(200_000),
    mode: z.enum(["create", "replace"])
  }).strict()).max(200),
  managed_links: z.array(z.object({
    from: z.string().min(1).max(1_024),
    to: z.string().min(1).max(1_024),
    relation: z.string().min(1).max(80)
  }).strict()).max(500).optional()
}).strict();

export function createPreviewSourceIntakeTool(): UnboundToolDefinition {
  return {
    name: "preview_obsidian_source_intake",
    description: toolDescription("preview_obsidian_source_intake"),
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      context.services.sourceInspector ??= createSourceInspector(context.services.vault);
      context.services.sourceIntakeWriter ??= createSourceIntakeWriter({
        vault: context.services.vault,
        inspector: context.services.sourceInspector,
        knowledgeWriter: context.services.knowledgeWriter
      });
      const preview = await context.services.sourceIntakeWriter.preview({
        sources: values.sources.map((source) => ({
          sourceId: source.source_id,
          destination: source.destination,
          ...(source.project ? { project: source.project } : {})
        })),
        notes: values.notes,
        managedLinks: values.managed_links ?? []
      });
      return context.success("สร้างตัวอย่างนำเข้าแล้วครับ โปรดตรวจไฟล์ต้นฉบับ โน้ต และลิงก์ใน Canvas ก่อนยืนยัน", {
        preview_id: preview.id,
        sources: preview.sources.map((source) => ({
          name: source.handle.name,
          origin: source.handle.origin,
          destination: source.destination,
          sha256: source.handle.sha256,
          operation: source.copy ? "copy" : "register_in_place",
          ...(source.project ? { project: source.project } : {})
        })),
        notes: preview.knowledge.files.map((file) => ({ path: file.path, proposed_hash: file.proposedHash })),
        graph: preview.graph,
        expires_at: preview.expiresAt
      });
    }
  };
}
