# Tech Context

## Commands

| Task | Command |
|---|---|
| Install | `npm ci` |
| Source gate | `npm run check` |
| Secret gate | `npm run scan:secrets` |
| Runtime smoke | `npm run smoke` |
| Package | `npm run bundle && npm run bundle:verify` |
| Contract doctor | `make doctor` |

## Environment

- Node.js: >=20
- Package manager: npm with committed lockfile
- Targets: macOS (`darwin`) and Windows (`win32`)

## Key files

| Path | Purpose |
|---|---|
| `manifest.json` | MCPB v0.4 package metadata |
| `src/contracts.ts` | Stable tools and result envelope |
| `docs/TESTING.md` | Evidence lanes |
