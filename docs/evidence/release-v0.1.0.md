# Public Release Evidence — v0.1.0

Recorded: 2026-08-09

## Source and review

- Repository: <https://github.com/zierocode/pir2-academy-obsidian-vault-mcp>
- Source PR: <https://github.com/zierocode/pir2-academy-obsidian-vault-mcp/pull/1>
- Release-contract PR: <https://github.com/zierocode/pir2-academy-obsidian-vault-mcp/pull/2>
- Release target commit: `d4a4aa9cf6be1e0510d3a1b360e7f0f84fb0f37e`

Both PR checks and both merge-result workflows passed on `macos-latest` and
`windows-latest`. The release-contract merge-result workflow is:
<https://github.com/zierocode/pir2-academy-obsidian-vault-mcp/actions/runs/31310272731>.

## Release asset

- Release: <https://github.com/zierocode/pir2-academy-obsidian-vault-mcp/releases/tag/v0.1.0>
- Asset: `pir2-academy-obsidian-vault-0.1.0.mcpb`
- Size: `2160486` bytes
- SHA-256: `23586ad23d931db538a61c26881913302cf411be6fa80a86943f8a17dc780c8b`

The asset was downloaded from the published GitHub Release into a fresh
temporary directory. Its locally computed SHA-256 matched both the release
asset digest reported by GitHub and the release candidate built from merged
`main`.

## Boundary

This evidence proves public source, CI, tag/release, asset availability, and
byte integrity. Clean-machine learner installation on macOS and Windows remains
owned by the private course OS matrix.
