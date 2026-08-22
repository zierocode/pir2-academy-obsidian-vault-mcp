# Live Project State

Last source verification: v0.2.0 source gate passed on 2026-08-22
Source revision: candidate branch `codex/obsidian-mcp-v020`; latest public release remains `v0.1.0`

## Current verified source state

- Environment: local Node.js source checkout
- Entrypoint: `server/index.js` serves the stdio MCP when `APPROVED_VAULT_ROOT` is configured
- Package contract: candidate `pir2-academy-obsidian-vault@0.2.0` with seven MCP tools
- Read/index path: filesystem-direct Thai Markdown and Wikilinks; Obsidian may be closed
- Vault boundary: every configured-root ancestor and existing note-path component must be non-symlink; protected directories, traversal, absolute paths, Windows device aliases, trailing dot/space names, and alternate data streams are denied
- Write safety: previews expire after ten minutes, are single-consumption on confirmed apply, are pruned and bounded in memory, recheck source hashes, back up replacements, and write atomically
- Deploy path: intentionally absent
- Candidate artifact: deterministic `pir2-academy-obsidian-vault-0.2.0.mcpb`; not published
- Candidate SHA-256: `b95e9185dd261cb2e3d2a52f3778a076476375a7163ca9fd181d317271b93664`

## Evidence scope

- Local source gates cover the MCP SDK flow, path boundary, direct index, linked graph, write transaction, deterministic MCPB bundle, and secret scan.
- Source verification is independent from the separate disposable-vault Claude Desktop/Cowork host canary recorded in the private course repository.

## Published release evidence

- Public repository: `zierocode/pir2-academy-obsidian-vault-mcp`.
- Release: `v0.1.0`, non-draft and non-prerelease, targeting `d4a4aa9`.
- Downloaded release asset SHA-256: `23586ad23d931db538a61c26881913302cf411be6fa80a86943f8a17dc780c8b`.
- PR and merge-result CI passed on macOS and Windows; see `docs/evidence/release-v0.1.0.md`.
- Clean-machine macOS and Windows learner proof remains deferred to the course OS matrix.

## Rollback

- Revert source through a new PR. Marking the public release as a draft or deleting it remains an explicit owner-confirmation action.
