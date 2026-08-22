import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import type { ApprovedVault } from "../vault/vault-root.js";
import type { GraphIndex } from "./types.js";

const nodeSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  aliases: z.array(z.string()),
  properties: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  contentHash: z.string()
}).strict();

const edgeSchema = z.object({
  from: z.string(),
  to: z.string().nullable(),
  rawTarget: z.string(),
  kind: z.enum(["wikilink", "embed", "property"]),
  relation: z.string(),
  unresolved: z.boolean(),
  resolution: z.enum(["relative", "vault", "basename", "alias", "ambiguous", "missing"])
}).strict();

const graphSchema = z.object({
  schemaVersion: z.literal(1),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  outgoing: z.record(z.string(), z.array(z.string())),
  backlinks: z.record(z.string(), z.array(z.string()))
}).strict();

const persistedSchema = z.object({
  schema_version: z.literal(1),
  root_fingerprint: z.string().length(64),
  built_at: z.iso.datetime(),
  index: graphSchema
}).strict();

export async function saveGraphIndex(
  vault: ApprovedVault,
  index: GraphIndex,
  now: () => number = Date.now
): Promise<void> {
  const directory = resolve(vault.realRoot, ".pir-acdm");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const payload = {
    schema_version: 1,
    root_fingerprint: fingerprint(vault),
    built_at: new Date(now()).toISOString(),
    index
  };
  const validated = persistedSchema.parse(payload);
  await writeFileAtomic(resolve(directory, "graph-index.json"), `${JSON.stringify(validated, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
}

export async function readGraphIndex(
  vault: ApprovedVault
): Promise<{ status: "missing" | "corrupt" | "wrong_root" } | { status: "ready"; index: GraphIndex }> {
  let content: string;
  try {
    content = await readFile(resolve(vault.realRoot, ".pir-acdm/graph-index.json"), "utf8");
  } catch (error) {
    if (isNotFound(error)) return { status: "missing" };
    return { status: "corrupt" };
  }
  try {
    const parsed = persistedSchema.parse(JSON.parse(content));
    if (parsed.root_fingerprint !== fingerprint(vault)) return { status: "wrong_root" };
    return { status: "ready", index: parsed.index };
  } catch {
    return { status: "corrupt" };
  }
}

function fingerprint(vault: ApprovedVault): string {
  return createHash("sha256").update(vault.realRoot).digest("hex");
}

function isNotFound(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT";
}
