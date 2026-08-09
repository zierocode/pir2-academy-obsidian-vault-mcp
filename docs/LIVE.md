# Live Project State

Last source verification: 2026-08-09
Source revision: `codex/obsidian-vault-mcp` release candidate; public repository and GitHub release pending

## Current verified source state

- Environment: local Node.js source checkout
- Entrypoint: `server/index.js` serves the stdio MCP when `APPROVED_VAULT_ROOT` is configured
- Package contract: `pir2-academy-obsidian-vault@0.1.0` with six MCP tools
- Vault boundary: every configured-root ancestor and existing note-path component must be non-symlink; protected directories, traversal, absolute paths, Windows device aliases, trailing dot/space names, and alternate data streams are denied
- Write safety: previews expire after ten minutes, are single-consumption on confirmed apply, are pruned and bounded in memory, recheck source hashes, back up replacements, and write atomically
- Deploy path: intentionally absent
- Release candidate: deterministic `pir2-academy-obsidian-vault-0.1.0.mcpb`

## Evidence scope

- Local source gates cover the MCP SDK flow, path boundary, CLI adapter, write transaction, deterministic MCPB bundle, and secret scan.
- Source verification is independent from the separate disposable-vault Claude Desktop/Cowork host canary recorded in the private course repository.

## External release boundary

- Public repository creation, merge-result CI, GitHub tag/release, and downloadable-asset checksum remain pending until the publication workflow completes.
- Clean-machine macOS and Windows learner proof remains deferred to the course OS matrix.

## Rollback

- Before publication, discard the release branch. After publication, mark the GitHub release as a draft or delete only with explicit owner confirmation; source history remains recoverable from Git.
