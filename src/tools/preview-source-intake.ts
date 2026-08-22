import { z } from "zod";
import { toolDescription } from "../contracts.js";
import { VaultToolError } from "../errors.js";
import type { UnboundToolDefinition } from "../server.js";

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
    handler: async () => {
      throw new VaultToolError("SOURCE_PREVIEW_REQUIRED", "source intake preview is not initialized");
    }
  };
}
