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
    handler: async () => {
      throw new VaultToolError("SOURCE_PREVIEW_REQUIRED", "source intake preview is unavailable");
    }
  };
}
