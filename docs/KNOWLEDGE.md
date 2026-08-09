# Knowledge Links

This file links the repo execution truth to Zie's `_Codex` vault command center.

## Obsidian

- Project cockpit: `obsidian://open?vault=zie&file=_Codex/Projects/<project>/Home`
- All projects: `obsidian://open?vault=zie&file=_Codex/Bases/all-projects.base`
- All backlog: `obsidian://open?vault=zie&file=_Codex/Bases/all-backlog.base`
- All releases: `obsidian://open?vault=zie&file=_Codex/Bases/all-releases.base`

## Repo Truth

- Identity: `memory-bank/project.md`
- Architecture: `memory-bank/architecture.md`
- Current work: `memory-bank/active-context.md`
- Recent changes: `memory-bank/progress.md`, `CHANGELOG.md`
- Decisions: `docs/adr/`
- Runtime/deploy: `docs/LIVE.md`
- Testing: `docs/TESTING.md`
- Next actions: `docs/ROADMAP.md`
- Roadmap scope: `docs/ROADMAP.md`
- Features: `docs/FEATURES.md`
- Changelog: `CHANGELOG.md`

Audit the mapping with `project-context audit . --strict`. Generate a
source-linked reader view only when needed with `project-context export .`; the
export is not project truth.
