# PiR2 Academy Obsidian Vault MCP

MCP แบบ local สำหรับอ่าน ค้นหา เปิด และเขียน Obsidian Markdown ภายใน Vault ที่ผู้เรียนเลือกเพียงหนึ่งแห่งอย่างปลอดภัย

## ขอบเขต

Bundle นี้มี six tools: status, search, read, preview write, confirmed apply write, และ open. การตีความ meeting, decision/action extraction, และ weekly brief อยู่ใน Skill ของคอร์ส ไม่ใช่ MCP นี้

ทุก read/write ถูกจำกัดอยู่ใน approved vault root เดียว และปฏิเสธ `.obsidian`, `.pir2-academy-backups`, traversal, absolute path, symlink, และไฟล์ที่ไม่ใช่ Markdown. การเขียนต้อง preview ก่อน แล้วใช้ `ยืนยันบันทึก` หรือ `Confirm write` ที่ยังใหม่เท่านั้น

v1 ไม่มี delete, rename, move, bulk write, plugin install, shell command, remote sync, cloud vault, หรือ credential flow

## Requirements

- Node.js 20+
- Obsidian installer 1.12.7+ with Command line interface enabled
- Obsidian app available on the learner machine

## Maintainer commands

```sh
npm ci
npm run check
npm run smoke
npm run scan:secrets
npm run bundle
npm run bundle:verify
make status
make release
make deploy
make rollback
make doctor
```

`npm run bundle` writes the local deterministic release candidate to
`dist/pir2-academy-obsidian-vault-0.1.0.mcpb` and prints its SHA-256 checksum.
`npm run bundle:verify` validates its MCPB v0.4 metadata, runtime dependency
closure, executable entry point, and exclusions. These commands do not publish,
install, or upload the bundle.

`make release` is the local secret-scan/build/verify gate. `make deploy` records
that this project has no deployed service—the `.mcpb` is distributed only as a
GitHub Release asset. `make rollback` reports the protected owner boundary for
reverting a published release.

The package icon is the unchanged PiR2 Academy course-owned icon reused from
`course-assets/create-mcp/sheets-reader-workshop/assets/icons/icon.png`
(SHA-256 `d79748c26865b1b3d2b45810874648b73e7eecc4c887bbff30baffdaf5cf54c7`).

The current verified state is recorded in `docs/LIVE.md`; test evidence is in `docs/TESTING.md`.
