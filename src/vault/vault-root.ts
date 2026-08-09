import { lstat, realpath, stat } from "node:fs/promises";
import { join, parse, resolve, sep } from "node:path";
import { VaultToolError } from "../errors.js";

export type ApprovedVault = {
  root: string;
  realRoot: string;
};

async function containsSymbolicLink(path: string): Promise<boolean> {
  const parsed = parse(path);
  let current = parsed.root;
  if ((await lstat(current)).isSymbolicLink()) return true;

  for (const component of path.slice(parsed.root.length).split(sep).filter(Boolean)) {
    current = join(current, component);
    if ((await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

export async function resolveApprovedVault(configuredPath: string): Promise<ApprovedVault> {
  const root = resolve(configuredPath);

  try {
    if (await containsSymbolicLink(root)) {
      throw new VaultToolError("VAULT_NOT_READY", "โฟลเดอร์ Obsidian Vault ที่เลือกยังไม่พร้อมใช้งาน");
    }
    const configuredDetails = await lstat(root);
    if (!configuredDetails.isDirectory()) throw new VaultToolError("VAULT_NOT_READY", "โฟลเดอร์ Obsidian Vault ที่เลือกยังไม่พร้อมใช้งาน");
    const realRoot = await realpath(root);
    const details = await stat(realRoot);
    if (!details.isDirectory()) {
      throw new VaultToolError("VAULT_NOT_READY", "โฟลเดอร์ Obsidian Vault ที่เลือกยังไม่พร้อมใช้งาน");
    }
    return { root, realRoot };
  } catch (error) {
    if (error instanceof VaultToolError) throw error;
    throw new VaultToolError("VAULT_NOT_READY", "โฟลเดอร์ Obsidian Vault ที่เลือกยังไม่พร้อมใช้งาน");
  }
}
