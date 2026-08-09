import { TOOL_DEFINITIONS } from "../contracts.js";
import { resolveNotePath } from "../vault/note-path.js";
import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";

const inputSchema = z.object({
  path: z.string().min(1).max(1_024)
}).strict();

export function createOpenNoteTool(): UnboundToolDefinition {
  return {
    name: "open_obsidian_note",
    description: TOOL_DEFINITIONS[5]!.description,
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const note = await resolveNotePath(context.services.vault, values.path);
      await context.services.runCli(["open", `path=${note.relativePath}`]);
      return context.success("เปิดโน้ตใน Obsidian แล้วครับ", { path: note.relativePath, opened: true });
    }
  };
}
