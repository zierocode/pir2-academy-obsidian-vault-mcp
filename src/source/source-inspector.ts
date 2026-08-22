import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { basename } from "node:path";
import { VaultToolError } from "../errors.js";
import type { ApprovedVault } from "../vault/vault-root.js";
import { resolveImportSource } from "./import-roots.js";
import { inspectSourcePolicy } from "./source-policy.js";
import type { SourceFamily } from "./types.js";

const HANDLE_TTL_MS = 10 * 60 * 1000;

export type SourceHandle = {
  sourceId: string;
  absolutePath: string;
  displayPath: string;
  origin: "external" | "vault";
  name: string;
  family: SourceFamily;
  mime: string;
  size: number;
  modifiedTime: number;
  sha256: string;
  expiresAt: number;
};

export type SourceInspector = {
  inspect(paths: readonly string[], clientRoots: readonly string[]): Promise<SourceHandle[]>;
  get(sourceId: string): Promise<SourceHandle>;
};

export function createSourceInspector(vault: ApprovedVault, now: () => number = Date.now): SourceInspector {
  const handles = new Map<string, SourceHandle>();
  return {
    async inspect(paths, clientRoots) {
      const results: SourceHandle[] = [];
      for (const path of paths) {
        const resolved = await resolveImportSource(path, clientRoots, vault);
        const details = await stat(resolved.absolutePath);
        const prefix = await readPrefix(resolved.absolutePath, 32);
        const policy = inspectSourcePolicy(basename(resolved.absolutePath), prefix, { declaredSize: details.size });
        if (!policy.accepted) {
          const code = policy.reason === "limit_exceeded" ? "SOURCE_LIMIT_EXCEEDED" : "SOURCE_UNSUPPORTED";
          throw new VaultToolError(code, `source rejected: ${policy.reason}`);
        }
        const handle: SourceHandle = {
          sourceId: randomUUID(),
          absolutePath: resolved.absolutePath,
          displayPath: resolved.displayPath,
          origin: resolved.origin,
          name: basename(resolved.absolutePath),
          family: policy.family,
          mime: policy.mime,
          size: details.size,
          modifiedTime: details.mtimeMs,
          sha256: await sha256(resolved.absolutePath),
          expiresAt: now() + HANDLE_TTL_MS
        };
        handles.set(handle.sourceId, handle);
        results.push(handle);
      }
      return results;
    },
    async get(sourceId) {
      const handle = handles.get(sourceId);
      if (!handle || now() > handle.expiresAt) {
        handles.delete(sourceId);
        throw new VaultToolError("SOURCE_PREVIEW_EXPIRED", "source inspection expired");
      }
      const details = await stat(handle.absolutePath).catch(() => undefined);
      if (!details || details.size !== handle.size || details.mtimeMs !== handle.modifiedTime || await sha256(handle.absolutePath) !== handle.sha256) {
        throw new VaultToolError("SOURCE_CHANGED", "source changed after inspection");
      }
      return handle;
    }
  };
}

async function readPrefix(path: string, length: number): Promise<Uint8Array> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function sha256(path: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}
