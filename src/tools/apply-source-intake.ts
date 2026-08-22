import { z } from "zod";
import { toolDescription } from "../contracts.js";
import { VaultToolError } from "../errors.js";
import type { UnboundToolDefinition } from "../server.js";

const inputSchema = z.object({
  preview_id: z.string().min(1).max(128),
  confirmation: z.enum(["ยืนยันนำเข้า", "Confirm import"])
}).strict();

export function createApplySourceIntakeTool(): UnboundToolDefinition {
  return {
    name: "apply_obsidian_source_intake",
    description: toolDescription("apply_obsidian_source_intake"),
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      if (!context.services.sourceIntakeWriter) throw new VaultToolError("SOURCE_PREVIEW_REQUIRED", "source intake preview is unavailable");
      const receipt = await context.services.sourceIntakeWriter.apply(values.preview_id, values.confirmation);
      return context.success("นำไฟล์เข้า Second Brain และอัปเดต Knowledge Graph สำเร็จแล้วครับ", {
        receipt_id: receipt.receiptId,
        copied_sources: receipt.copiedSources,
        registered_sources: receipt.registeredSources,
        generated_notes: receipt.generatedNotes,
        graph: receipt.graph
      });
    }
  };
}
