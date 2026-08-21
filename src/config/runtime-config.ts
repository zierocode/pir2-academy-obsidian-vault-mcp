import { hashPath } from "../logging.js";

export type RuntimeConfig = { vaultRoot: string; pluginData: string };

export function parseRuntimeConfig(argv: readonly string[]): RuntimeConfig {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !value || values.has(key)) throw new Error("INVALID_RUNTIME_CONFIG");
    values.set(key, value);
  }
  const vaultRoot = values.get("--vault-root")?.trim();
  const pluginData = values.get("--plugin-data")?.trim();
  if (!vaultRoot || !pluginData) throw new Error("INVALID_RUNTIME_CONFIG");
  return { vaultRoot, pluginData };
}

export function formatRuntimeReadyDiagnostic(config: RuntimeConfig, canonicalVaultRoot: string): string {
  return JSON.stringify({
    event: "runtime_ready",
    vault_path_hash: hashPath(canonicalVaultRoot),
    plugin_data_path_hash: hashPath(config.pluginData)
  });
}
