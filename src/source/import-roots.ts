import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { VaultToolError } from "../errors.js";
import type { ApprovedVault } from "../vault/vault-root.js";

export type ResolvedImportSource = {
  absolutePath: string;
  displayPath: string;
  origin: "external" | "vault";
};

export async function resolveImportSource(
  candidate: string,
  clientRoots: readonly string[],
  vault: ApprovedVault
): Promise<ResolvedImportSource> {
  if (!isAbsolute(candidate)) throw inaccessible();
  const absolute = resolve(candidate);
  let canonical: string;
  try {
    if ((await lstat(absolute)).isSymbolicLink()) throw inaccessible();
    canonical = await realpath(absolute);
    if (!(await lstat(canonical)).isFile()) throw inaccessible();
  } catch (error) {
    if (error instanceof VaultToolError) throw error;
    throw inaccessible();
  }
  if (within(canonical, vault.realRoot)) {
    return { absolutePath: canonical, displayPath: portable(relative(vault.realRoot, canonical)), origin: "vault" };
  }
  for (const root of clientRoots) {
    try {
      const canonicalRoot = await realpath(resolve(root));
      if (within(canonical, canonicalRoot)) {
        return { absolutePath: canonical, displayPath: portable(relative(canonicalRoot, canonical)), origin: "external" };
      }
    } catch {
      continue;
    }
  }
  throw inaccessible();
}

function within(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function portable(path: string): string {
  return path.split(sep).join("/");
}

function inaccessible(): VaultToolError {
  return new VaultToolError("SOURCE_NOT_ACCESSIBLE", "source is outside approved Cowork roots or the Vault");
}
