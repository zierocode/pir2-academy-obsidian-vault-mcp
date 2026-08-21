import { toolDescription } from "../contracts.js";
import { VaultToolError } from "../errors.js";
import type { UnboundToolDefinition } from "../server.js";
import { z } from "zod";

const exploreSchema = z.object({
  path: z.string().min(1).max(1_024).optional(),
  query: z.string().min(1).max(500).optional(),
  direction: z.enum(["outgoing", "backlinks", "both"]).default("both"),
  max_depth: z.number().int().min(1).max(2).default(1),
  limit: z.number().int().min(1).max(200).default(50)
}).strict().refine((value) => Boolean(value.path || value.query), {
  message: "path or query is required"
});

const previewBuildSchema = z.object({
  mode: z.enum(["initialize", "refresh", "repair"]),
  profile: z.record(z.string(), z.unknown()).optional(),
  notes: z.array(z.object({
    path: z.string().min(1).max(1_024),
    content: z.string().max(200_000),
    mode: z.enum(["create", "replace"])
  }).strict()).max(200).default([]),
  managed_links: z.array(z.object({
    from: z.string().min(1).max(1_024),
    to: z.string().min(1).max(1_024),
    relation: z.string().min(1).max(80)
  }).strict()).max(500).default([])
}).strict();

const applyBuildSchema = z.object({
  preview_id: z.string().min(1).max(128),
  confirmation: z.string().min(1).max(64)
}).strict();

const auditSchema = z.object({
  mode: z.enum(["quick", "full"]).default("quick")
}).strict();

const rollbackSchema = z.object({
  receipt_id: z.string().min(1).max(128),
  confirmation: z.string().min(1).max(64)
}).strict();

export function createExploreGraphTool(): UnboundToolDefinition {
  return {
    name: "explore_obsidian_graph",
    description: toolDescription("explore_obsidian_graph"),
    inputSchema: exploreSchema,
    handler: async () => {
      throw new VaultToolError("GRAPH_UNINITIALIZED", "graph is not initialized");
    }
  };
}

export function createPreviewKnowledgeBuildTool(): UnboundToolDefinition {
  return {
    name: "preview_obsidian_knowledge_build",
    description: toolDescription("preview_obsidian_knowledge_build"),
    inputSchema: previewBuildSchema,
    handler: async () => {
      throw new VaultToolError("GRAPH_UNINITIALIZED", "knowledge build is not implemented");
    }
  };
}

export function createApplyKnowledgeBuildTool(): UnboundToolDefinition {
  return {
    name: "apply_obsidian_knowledge_build",
    description: toolDescription("apply_obsidian_knowledge_build"),
    inputSchema: applyBuildSchema,
    handler: async () => {
      throw new VaultToolError("BUILD_PREVIEW_REQUIRED", "knowledge build preview is required");
    }
  };
}

export function createAuditGraphTool(): UnboundToolDefinition {
  return {
    name: "audit_obsidian_graph",
    description: toolDescription("audit_obsidian_graph"),
    inputSchema: auditSchema,
    handler: async (_input, context) => context.success("ตรวจสุขภาพกราฟเบื้องต้นแล้วครับ", {
      initialized: false,
      healthy: false,
      issues: [{ code: "GRAPH_UNINITIALIZED" }]
    })
  };
}

export function createRollbackChangeTool(): UnboundToolDefinition {
  return {
    name: "rollback_obsidian_change",
    description: toolDescription("rollback_obsidian_change"),
    inputSchema: rollbackSchema,
    handler: async () => {
      throw new VaultToolError("ROLLBACK_NOT_FOUND", "rollback receipt was not found");
    }
  };
}
