import { toolDescription } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";

const inputSchema = z.object({
  preview_id: z.string().min(1).max(128),
  confirmation: z.string().min(1).max(64)
}).strict();

export function createApplyNoteWriteTool(): UnboundToolDefinition {
  return {
    name: "apply_obsidian_note_write",
    description: toolDescription("apply_obsidian_note_write"),
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const receipt = await context.services.writer.applyWrite(values.preview_id, values.confirmation);
      return context.success("บันทึกโน้ตตามตัวอย่างที่ยืนยันแล้วครับ", {
        path: receipt.notePath,
        before_hash: receipt.beforeHash,
        proposed_hash: receipt.proposedHash,
        ...(receipt.backupPath ? { backup_path: receipt.backupPath } : {})
      });
    }
  };
}
