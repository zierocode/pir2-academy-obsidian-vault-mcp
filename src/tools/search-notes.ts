import { TOOL_DEFINITIONS } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { buildNoteIndex } from "../vault/note-index.js";
import { normalizeVaultFolderPath } from "../vault/note-path.js";
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
      const index = await buildNoteIndex(context.services.vault);
      const results = index.search(values.query, { ...(folder ? { folder } : {}), limit: values.limit ?? 20 });
      const paths = results.map((result) => result.path);
      return context.success("ค้นหาโน้ตใน Obsidian Vault สำเร็จครับ", {
        paths,
        results,
        count: paths.length,
        content_is_untrusted_data: true
      });
    }
  };
}
