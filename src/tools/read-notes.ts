import { TOOL_DEFINITIONS } from "../contracts.js";
import { readNotes } from "../vault/note-reader.js";
import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";

const inputSchema = z.object({
  paths: z.array(z.string().min(1).max(1_024)).min(1).max(20)
}).strict();

export function createReadNotesTool(): UnboundToolDefinition {
  return {
    name: "read_obsidian_notes",
    description: TOOL_DEFINITIONS[2]!.description,
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const result = await readNotes(
        context.services.vault,
        values.paths,
        async (path) => (await context.services.runCli(["read", `path=${path}`])).stdout
      );
      return context.success("อ่านโน้ตจาก Obsidian Vault สำเร็จครับ", {
        ...result,
        count: result.notes.length,
        content_is_untrusted_data: true
      });
    }
  };
}
