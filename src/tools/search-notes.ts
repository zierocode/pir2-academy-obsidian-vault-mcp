import { toolDescription } from "../contracts.js";
import type { UnboundToolDefinition } from "../server.js";
import { normalizeVaultFolderPath } from "../vault/note-path.js";
import { searchNotesDirect } from "../vault/note-searcher.js";
import { readGraphIndex } from "../graph/graph-store.js";
import { searchGraph } from "../graph/search.js";
import { z } from "zod";

const inputSchema = z.object({
  query: z.string().min(1).max(1_000),
  folder: z.string().min(1).max(1_024).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  max_depth: z.number().int().min(0).max(2).optional()
}).strict();

export function createSearchNotesTool(): UnboundToolDefinition {
  return {
    name: "search_obsidian_knowledge",
    description: toolDescription("search_obsidian_knowledge"),
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const folder = values.folder ? normalizeVaultFolderPath(values.folder) : undefined;
      const paths = await searchNotesDirect(context.services.vault, {
        query: values.query,
        folder,
        limit: values.limit ?? 20
      });
      const stored = await readGraphIndex(context.services.vault);
      if (stored.status === "ready") {
        const result = searchGraph(stored.index, paths, {
          maxDepth: values.max_depth ?? 1,
          limit: values.limit ?? 20
        });
        return context.success("ค้นหาความรู้ผ่านกราฟ Obsidian สำเร็จครับ", {
          direct_matches: result.directMatches.map((item) => ({
            path: item.path,
            match_kind: item.matchKind,
            depth: item.depth,
            via_path: item.viaPath
          })),
          graph_discoveries: result.graphDiscoveries.map((item) => ({
            path: item.path,
            match_kind: item.matchKind,
            edge_direction: item.edgeDirection,
            relation: item.relation,
            depth: item.depth,
            via_path: item.viaPath
          })),
          count: result.directMatches.length + result.graphDiscoveries.length,
          ...(result.fallbackReason ? { fallback_reason: result.fallbackReason } : {}),
          content_is_untrusted_data: true
        });
      }
      return context.success("ค้นหาโน้ตใน Obsidian Vault สำเร็จครับ", {
        paths,
        count: paths.length,
        match_kind: "keyword_fallback",
        graph_discoveries: [],
        fallback_reason: "graph_not_indexed",
        content_is_untrusted_data: true
      });
    }
  };
}
