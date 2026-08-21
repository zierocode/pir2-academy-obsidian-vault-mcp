import { describe, expect, it } from "vitest";
import { formatRuntimeReadyDiagnostic, parseRuntimeConfig } from "../../src/config/runtime-config.js";
import { hashPath } from "../../src/logging.js";

describe("parseRuntimeConfig", () => {
  it("accepts Thai and space-containing absolute paths", () => {
    expect(
      parseRuntimeConfig([
        "--vault-root",
        "/Users/ซี/Obsidian Vault/คลังความรู้",
        "--plugin-data",
        "/Users/ซี/Library/Application Support/Claude/plugins/data"
      ])
    ).toEqual({
      vaultRoot: "/Users/ซี/Obsidian Vault/คลังความรู้",
      pluginData: "/Users/ซี/Library/Application Support/Claude/plugins/data"
    });
  });

  it("rejects a missing vault root", () => {
    expect(() =>
      parseRuntimeConfig(["--plugin-data", "/tmp/plugin-data"])
    ).toThrow("INVALID_RUNTIME_CONFIG");
  });

  it("rejects repeated vault-root arguments", () => {
    expect(() =>
      parseRuntimeConfig([
        "--vault-root",
        "/tmp/one",
        "--vault-root",
        "/tmp/two",
        "--plugin-data",
        "/tmp/plugin-data"
      ])
    ).toThrow("INVALID_RUNTIME_CONFIG");
  });

  it("rejects missing values and odd argument lists", () => {
    expect(() => parseRuntimeConfig(["--vault-root"])).toThrow("INVALID_RUNTIME_CONFIG");
    expect(() =>
      parseRuntimeConfig(["--vault-root", "/tmp/vault", "--plugin-data"])
    ).toThrow("INVALID_RUNTIME_CONFIG");
  });

  it("formats startup evidence with canonical path hashes and no raw paths", () => {
    const config = {
      vaultRoot: "/Users/ซี/Obsidian Vault/คลังความรู้",
      pluginData: "/Users/ซี/Library/Application Support/Claude/plugins/data"
    };
    const diagnostic = formatRuntimeReadyDiagnostic(config, config.vaultRoot);

    expect(diagnostic).toBe(JSON.stringify({
      event: "runtime_ready",
      vault_path_hash: hashPath(config.vaultRoot),
      plugin_data_path_hash: hashPath(config.pluginData)
    }));
    expect(diagnostic).not.toContain(config.vaultRoot);
    expect(diagnostic).not.toContain(config.pluginData);
  });
});
