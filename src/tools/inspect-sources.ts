import { z } from "zod";
import { toolDescription } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { createSourceInspector } from "../source/source-inspector.js";

const inputSchema = z.object({
  paths: z.array(z.string().min(1).max(1_024)).min(1).max(20)
}).strict();

export function createInspectSourcesTool(): UnboundToolDefinition {
  return {
    name: "inspect_obsidian_sources",
    description: toolDescription("inspect_obsidian_sources"),
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const roots = await context.services.listClientRoots?.() ?? [];
      context.services.sourceInspector ??= createSourceInspector(context.services.vault);
      const sources = await context.services.sourceInspector.inspect(values.paths, roots);
      return context.success("ตรวจไฟล์ต้นทางแล้วครับ Cowork สามารถอ่านและสรุปเนื้อหาก่อนสร้างตัวอย่างนำเข้าได้", {
        count: sources.length,
        sources: sources.map((source) => ({
          source_id: source.sourceId,
          name: source.name,
          path: source.displayPath,
          origin: source.origin,
          family: source.family,
          mime: source.mime,
          size: source.size,
          sha256: source.sha256,
          content_reader: "cowork_native",
          expires_at: source.expiresAt
        }))
      });
    }
  };
}
