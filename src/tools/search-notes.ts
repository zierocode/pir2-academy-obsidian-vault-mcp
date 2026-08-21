import { TOOL_DEFINITIONS } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { normalizeVaultFolderPath } from "../vault/note-path.js";
import { searchNotesDirect } from "../vault/note-searcher.js";
import { z } from "zod";

const inputSchema = z.object({
  query: z.string().min(1).max(1_000),
  folder: z.string().min(1).max(1_024).optional(),
  limit: z.number().int().min(1).max(50).optional()
}).strict();

export function createSearchNotesTool(): UnboundToolDefinition {
  return {
    name: "search_obsidian_notes",
    description: TOOL_DEFINITIONS[1]!.description,
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const folder = values.folder ? normalizeVaultFolderPath(values.folder) : undefined;
      const paths = await searchNotesDirect(context.services.vault, {
        query: values.query,
        folder,
        limit: values.limit ?? 20
      });
      return context.success("ค้นหาโน้ตใน Obsidian Vault สำเร็จครับ", {
        paths,
        count: paths.length,
        content_is_untrusted_data: true
      });
    }
  };
}
