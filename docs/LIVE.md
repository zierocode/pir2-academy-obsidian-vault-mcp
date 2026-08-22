# Live Project State

Last source verification: 2026-08-21
Source revision: local release candidate `0.2.5`

## Current verified source state

- Environment: local Node.js source checkout
- Entrypoint: `server/index.js` serves a configuration-free UI-only stdio MCP
- Package contract: `pir2-academy-obsidian-vault@0.2.5` with `render_second_brain_workspace`
- Folder authority: Claude Cowork working folder selected once by the learner; no duplicate MCP Vault setting
- File safety: the course Skill enforces preview, exact `ยืนยันบันทึก`, relative paths, and readback through Cowork file tools
- Deploy path: intentionally absent
- Release candidate: deterministic `pir2-academy-obsidian-vault-0.2.5.mcpb`

## Evidence scope

- Local source gates cover the MCP SDK UI flow, retained vault-library safety, deterministic MCPB bundle, and secret scan.
- Source verification is independent from the separate disposable-vault Claude Desktop/Cowork host canary recorded in the private course repository.

## Published release evidence

- Public repository: `zierocode/pir2-academy-obsidian-vault-mcp`.
- Release: `v0.1.0`, non-draft and non-prerelease, targeting `d4a4aa9`.
- Downloaded release asset SHA-256: `23586ad23d931db538a61c26881913302cf411be6fa80a86943f8a17dc780c8b`.
- PR and merge-result CI passed on macOS and Windows; see `docs/evidence/release-v0.1.0.md`.
- Clean-machine macOS and Windows learner proof remains deferred to the course OS matrix.

## Rollback

- Revert source through a new PR. Marking the public release as a draft or deleting it remains an explicit owner-confirmation action.
