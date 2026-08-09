import { VaultToolError } from "../errors.js";
import { resolveNotePath } from "../vault/note-path.js";
import type { ApprovedVault } from "../vault/vault-root.js";

export async function parseSearchOutput(output: string, vault: ApprovedVault): Promise<string[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new VaultToolError("OBSIDIAN_CLI_ERROR", "Obsidian ส่งผลการค้นหาที่อ่านไม่ได้");
  }

  if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
    throw new VaultToolError("OBSIDIAN_CLI_ERROR", "Obsidian ส่งรูปแบบผลการค้นหาที่ไม่ถูกต้อง");
  }

  const safePaths: string[] = [];
  for (const candidate of parsed) {
    try {
      safePaths.push((await resolveNotePath(vault, candidate)).relativePath);
    } catch {
      // Search output is untrusted external data; unsafe or stale paths are omitted.
    }
  }
  return safePaths;
}
