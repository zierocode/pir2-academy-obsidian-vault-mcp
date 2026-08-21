import { toolDescription } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";

const inputSchema = z.object({
  path: z.string().min(1).max(1_024),
  content: z.string().max(200_000),
  mode: z.enum(["create", "replace"])
}).strict();

export function createPreviewNoteWriteTool(): UnboundToolDefinition {
  return {
    name: "preview_obsidian_note_write",
    description: toolDescription("preview_obsidian_note_write"),
    inputSchema,
    handler: async (input, context) => {
      const preview = await context.services.writer.previewWrite(input as z.infer<typeof inputSchema>);
      return context.success("สร้างตัวอย่างการเขียนโน้ตแล้วครับ โปรดตรวจและยืนยันก่อนบันทึก", {
        preview_id: preview.previewId,
        path: preview.notePath,
        mode: preview.mode,
        before_hash: preview.beforeHash,
        proposed_hash: preview.proposedHash,
        proposed_content: preview.proposedContent,
        expires_at: preview.expiresAt
      });
    }
  };
}
