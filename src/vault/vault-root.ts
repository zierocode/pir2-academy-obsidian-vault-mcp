import { lstat, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { VaultToolError } from "../errors.js";

export type ApprovedVault = {
  root: string;
  realRoot: string;
};

export async function resolveApprovedVault(configuredPath: string): Promise<ApprovedVault> {
  const root = resolve(configuredPath);

  try {
    const configuredDetails = await lstat(root);
    if (!configuredDetails.isDirectory() || configuredDetails.isSymbolicLink()) {
      throw new VaultToolError("VAULT_NOT_READY", "โฟลเดอร์ Obsidian Vault ที่เลือกยังไม่พร้อมใช้งาน");
    }
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
