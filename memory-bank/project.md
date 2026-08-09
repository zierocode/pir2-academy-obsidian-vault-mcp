# Project

## Goal

- Deliver `pir2-academy-obsidian-vault@0.1.0`, a generic local MCP for safe Markdown work in one learner-selected Obsidian vault.

## In scope

- Six stable tools, read boundary, preview/apply safety, official CLI adapter, stdio, MCPB, secret scan, and CI.

## Out of scope

- Note interpretation, weekly briefs, personal vaults, remote sync, credentials, deployment, and public release.

## Key decisions

| Decision | Rationale | Date |
|---|---|---|
| One approved vault root | Minimize filesystem authority | 2026-08-09 |
| Preview plus exact confirmation | Prevent accidental mutation | 2026-08-09 |
