import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { VaultToolError } from "../errors.js";
import type { ApprovedVault } from "./vault-root.js";

export type SourceRole = "source" | "generated";

export type SourceRecord = {
  id: string;
  path: string;
  type: string;
  role: SourceRole;
  size: number;
  modifiedTime: number;
  sha256: string;
  firstImported: number;
  lastSeen: number;
  revisionParentHash?: string;
  projectLinks: string[];
  generatedNoteLinks: string[];
  missing?: boolean;
};

export type SourceRegistry = {
  schemaVersion: 1;
  records: SourceRecord[];
};

const recordSchema = z.object({
  id: z.string().min(1).max(128),
  path: z.string().min(1).max(1_024),
  type: z.string().max(32),
  role: z.enum(["source", "generated"]),
  size: z.number().int().nonnegative(),
  modifiedTime: z.number().nonnegative(),
  sha256: z.string().length(64),
  firstImported: z.number().nonnegative(),
  lastSeen: z.number().nonnegative(),
  revisionParentHash: z.string().length(64).optional(),
  projectLinks: z.array(z.string().max(1_024)).max(100),
  generatedNoteLinks: z.array(z.string().max(1_024)).max(100),
  missing: z.boolean().optional()
}).strict();

const registrySchema = z.object({
  schemaVersion: z.literal(1),
  records: z.array(recordSchema).max(10_000)
}).strict();

export async function readSourceRegistry(vault: ApprovedVault): Promise<SourceRegistry> {
  try {
    const raw = await readFile(resolve(vault.realRoot, ".pir-acdm/source-registry.json"), "utf8");
    return registrySchema.parse(JSON.parse(raw));
  } catch (error) {
    if (isNotFound(error)) return { schemaVersion: 1, records: [] };
    throw new VaultToolError("GRAPH_CONFLICT", "source registry is corrupt");
  }
}

export async function saveSourceRegistry(vault: ApprovedVault, registry: SourceRegistry): Promise<void> {
  const validated = registrySchema.parse(registry);
  const directory = resolve(vault.realRoot, ".pir-acdm");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFileAtomic(resolve(directory, "source-registry.json"), `${JSON.stringify(validated, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
}

function isNotFound(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT";
}
