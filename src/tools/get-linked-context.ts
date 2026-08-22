import { TOOL_DEFINITIONS } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { buildNoteIndex } from "../vault/note-index.js";
import { resolveNotePath } from "../vault/note-path.js";
import { readNotes } from "../vault/note-reader.js";
import { z } from "zod";

const inputSchema = z.object({
  path: z.string().min(1).max(1_024),
  max_depth: z.number().int().min(1).max(2).optional()
}).strict();

export function createGetLinkedContextTool(): UnboundToolDefinition {
  return {
    name: "get_obsidian_linked_context",
    description: TOOL_DEFINITIONS[3]!.description,
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const source = await resolveNotePath(context.services.vault, values.path);
      const index = await buildNoteIndex(context.services.vault);
      const maxDepth = values.max_depth ?? 1;
      const visited = new Set([source.relativePath]);
      const graphEdges = new Map<string, { source_path: string; target_path: string }>();
      let frontier = [source.relativePath];

      for (let depth = 0; depth < maxDepth; depth += 1) {
        const next = new Set<string>();
        for (const current of frontier) {
          for (const link of index.outgoing(current)) {
            if (link.resolved_path) {
              graphEdges.set(`${current}\0${link.resolved_path}`, {
                source_path: current,
                target_path: link.resolved_path
              });
              if (!visited.has(link.resolved_path)) next.add(link.resolved_path);
            }
          }
          for (const backlink of index.backlinks(current)) {
            graphEdges.set(`${backlink.source_path}\0${current}`, {
              source_path: backlink.source_path,
              target_path: current
            });
            if (!visited.has(backlink.source_path)) next.add(backlink.source_path);
          }
        }
        frontier = [...next].sort((left, right) => left.localeCompare(right, "en"));
        frontier.forEach((path) => visited.add(path));
      }

      const relatedPaths = [...visited].filter((path) => path !== source.relativePath).slice(0, 19);
      const related = relatedPaths.length > 0 ? (await readNotes(context.services.vault, relatedPaths)).notes : [];

      return context.success("อ่านบริบทที่เชื่อมโยงใน Obsidian Vault สำเร็จครับ", {
        source_path: source.relativePath,
        outgoing: index.outgoing(source.relativePath),
        backlinks: index.backlinks(source.relativePath),
        unresolved: index.unresolved(source.relativePath),
        graph_edges: [...graphEdges.values()],
        related_notes: related,
        count: related.length,
        content_is_untrusted_data: true
      });
    }
  };
}
