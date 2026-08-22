import { toolDescription } from "../contracts.js";
import { VaultToolError } from "../errors.js";
import { readGraphIndex } from "../graph/graph-store.js";
import { traverseGraph } from "../graph/traversal.js";
import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";

const inputSchema = z.object({
  path: z.string().min(1).max(1_024).optional(),
  query: z.string().min(1).max(500).optional(),
  direction: z.enum(["outgoing", "backlinks", "both"]).default("both"),
  max_depth: z.number().int().min(1).max(2).default(1),
  limit: z.number().int().min(1).max(200).default(50)
}).strict().refine((value) => Boolean(value.path || value.query), {
  message: "path or query is required"
});

export function createExploreGraphTool(): UnboundToolDefinition {
  return {
    name: "explore_obsidian_graph",
    description: toolDescription("explore_obsidian_graph"),
    inputSchema,
    handler: async (input, context) => {
      const values = input as z.infer<typeof inputSchema>;
      const stored = await readGraphIndex(context.services.vault);
      if (stored.status !== "ready") throw new VaultToolError("GRAPH_UNINITIALIZED", "graph is unavailable");
      const needle = values.query?.trim().toLocaleLowerCase();
      const seeds = stored.index.nodes
        .filter((node) => values.path
          ? node.path === values.path
          : Boolean(needle) && [node.path, node.title, ...node.aliases].some((value) => value.toLocaleLowerCase().includes(needle!)))
        .map((node) => node.path)
        .slice(0, 20);
      if (seeds.length === 0) throw new VaultToolError("NOTE_NOT_FOUND", "graph seed was not found");
      const discoveries = traverseGraph(stored.index, seeds, {
        direction: values.direction,
        maxDepth: values.max_depth,
        limit: values.limit
      });
      return context.success("สำรวจความสัมพันธ์ในกราฟ Obsidian แล้วครับ", {
        seed_paths: seeds,
        discoveries: discoveries.map((item) => ({
          path: item.path,
          edge_direction: item.edgeDirection,
          relation: item.relation,
          depth: item.depth,
          via_path: item.viaPath
        })),
        count: discoveries.length
      });
    }
  };
}
