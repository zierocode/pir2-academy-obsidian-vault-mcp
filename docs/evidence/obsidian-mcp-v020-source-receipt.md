# Obsidian Vault MCP v0.2.0 source receipt

Date: 2026-08-22
Branch: `codex/obsidian-mcp-v020`

## Verified source gates

- `npm run check`: pass
- ESLint: pass
- TypeScript: pass
- Vitest: 17 files, 69 tests passed
- `npm run smoke`: `smoke=pass tools=7`
- `npm run scan:secrets`: pass
- `npm run bundle`: pass
- `npm run bundle:verify`: pass

## Artifact

- File: `pir2-academy-obsidian-vault-0.2.0.mcpb`
- SHA-256: `6ea24d9227b73b0733764b3e08a61158ece3c6e8ada55d06c67dbebffcb31e0f`
- Archive entries: 8 (single-file compiled runtime; no `node_modules` paths)
- Tool count: 7
- Runtime: filesystem-direct; Obsidian may be closed
- Upstream reference: `@bitbonsai/mcpvault@0.15.0`, commit
  `cceee7cf3e8c6c3969080fc54f0d52c881895f29`, MIT notice bundled

## Evidence boundary

This receipt proves source, stdio runtime and deterministic MCPB packaging. It
does not prove Claude Desktop installation or physical Windows behavior. Those
remain separate host gates.
