import { z } from "zod";
import { toolDescription } from "../contracts.js";
import { VaultToolError } from "../errors.js";
import type { UnboundToolDefinition } from "../server.js";

const inputSchema = z.object({
  paths: z.array(z.string().min(1).max(1_024)).min(1).max(20)
}).strict();

export function createInspectSourcesTool(): UnboundToolDefinition {
  return {
    name: "inspect_obsidian_sources",
    description: toolDescription("inspect_obsidian_sources"),
    inputSchema,
    handler: async () => {
      throw new VaultToolError("SOURCE_NOT_ACCESSIBLE", "source inspection is not initialized");
    }
  };
}
