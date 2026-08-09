# Repository agent contract

## Scope

This is the public TypeScript ESM source for the PiR2 Academy Obsidian Vault local MCP.

## Required commands

```sh
npm ci
npm run check
npm run smoke
npm run scan:secrets
npm run bundle
npm run bundle:verify
make doctor
```

## Non-negotiable boundaries

- Support Node.js 20 or later on macOS and Windows.
- Keep stdout exclusively for MCP JSON-RPC output; send diagnostics to stderr.
- Read and write only one configured approved vault root.
- Deny traversal, absolute paths, symlink components, `.obsidian`, backups, and non-Markdown targets.
- Require preview plus exact fresh confirmation before a write; preserve recoverable backups and atomic replacement.
- Do not add delete, rename, move, bulk write, shell execution, arbitrary CLI commands, remote sync, credentials, learner vaults, or course-only content.
- Do not commit secrets, generated bundles, personal notes, or test fixtures that resemble real credentials.

## Change method

- Read the approved task before editing and stay within its named files.
- Add or update focused behavior tests before production changes.
- Run the task's focused checks plus `npm run check` before committing.
- Keep `memory-bank/` within its documented budgets and run `make memory-doctor` after material updates.
