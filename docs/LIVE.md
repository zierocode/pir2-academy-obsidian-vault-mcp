# Live Project State

Last source verification: 2026-08-09
Source revision: local `codex/obsidian-vault-mcp` branch; not installed, deployed, published, or uploaded

## Current verified source state

- Environment: local Node.js source checkout
- Entrypoint: `server/index.js` serves the stdio MCP when `APPROVED_VAULT_ROOT` is configured
- Package contract: `pir2-academy-obsidian-vault@0.1.0` with six MCP tools
- Vault boundary: the configured root itself and every existing note-path component must be non-symlink; protected directories, traversal, absolute paths, Windows device aliases, trailing dot/space names, and alternate data streams are denied
- Write safety: previews expire after ten minutes, are single-consumption on confirmed apply, are pruned and bounded in memory, recheck source hashes, back up replacements, and write atomically
- Deploy path: intentionally absent

## Evidence scope

- Local source gates cover the MCP SDK flow, path boundary, CLI adapter, write transaction, deterministic MCPB bundle, and secret scan.
- No personal vault, Obsidian application, Claude Desktop/Cowork installation, or deployed host process was used for this source verification.

## Unverified host/runtime boundary

- Obsidian CLI 1.12.7+ availability and Claude Desktop/Cowork installation remain unverified on a learner machine.

## Rollback

- Revert the local source commit; no external state exists.
