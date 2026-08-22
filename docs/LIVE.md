# Live Project State

Last source verification: 2026-08-22
Source revision: candidate branch `codex/obsidian-universal-knowledge-graph`; latest published release remains `v0.1.0`

## Current verified source state

- Environment: local Node.js source checkout
- Entrypoint: `server/index.js` serves the stdio MCP when `APPROVED_VAULT_ROOT` is configured
- Package contract: candidate `pir-acdm-obsidian-vault@0.5.0` with 15 MCP tools
- Vault boundary: every configured-root ancestor and existing note-path component must be non-symlink; protected directories, traversal, absolute paths, Windows device aliases, trailing dot/space names, and alternate data streams are denied
- Graph lifecycle: scan, search, explore, inspect, preview, atomic build, audit, receipt-bound rollback, and managed source intake remain inside the approved Vault root
- Write safety: previews expire after ten minutes, are single-consumption on confirmed apply, recheck source hashes, back up replacements, and write atomically
- Deploy path: intentionally absent
- Local release candidate: deterministic `pir-acdm-obsidian-vault-0.5.0.mcpb`

## Evidence scope

- Local source gates cover the MCP SDK flow, path boundary, 15-tool contract, graph lifecycle, managed source intake, rollback, deterministic MCPB bundle, and secret scan.
- Source verification is independent from the separate disposable-vault Claude Desktop/Cowork host canary recorded in the private course repository.
- No published `v0.5.0` release or clean-machine learner proof is claimed by this source state.

## Published release evidence

- Public repository: `zierocode/pir2-academy-obsidian-vault-mcp`.
- Release: `v0.1.0`, non-draft and non-prerelease, targeting `d4a4aa9`.
- Downloaded release asset SHA-256: `23586ad23d931db538a61c26881913302cf411be6fa80a86943f8a17dc780c8b`.
- PR and merge-result CI passed on macOS and Windows; see `docs/evidence/release-v0.1.0.md`.
- Clean-machine macOS and Windows learner proof remains deferred to the course OS matrix.

## Rollback

- Revert source through a new PR. Marking the public release as a draft or deleting it remains an explicit owner-confirmation action.
