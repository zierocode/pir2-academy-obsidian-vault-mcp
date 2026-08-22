import { z } from "zod";
import { toolDescription } from "../contracts.js";
import { VaultToolError } from "../errors.js";
import type { UnboundToolDefinition } from "../server.js";

const inputSchema = z.object({
  source_id: z.string().min(1).max(128)
}).strict();

export function createReadSourceContentTool(): UnboundToolDefinition {
  return {
    name: "read_obsidian_source_content",
    description: toolDescription("read_obsidian_source_content"),
    inputSchema,
    handler: async () => {
      throw new VaultToolError("SOURCE_NOT_ACCESSIBLE", "source inspection handle is unavailable");
    }
  };
}
