# PiR2 Academy Obsidian Second Brain UI

MCP App แบบ local สำหรับแสดง UI ภาษาไทยของ Second Brain ใน Claude Cowork

## ขอบเขต

Bundle สำหรับผู้เรียนมีเครื่องมือเดียวคือ `render_second_brain_workspace` สำหรับ UI แบบโต้ตอบใน Claude การอ่าน ค้น และเขียนไฟล์ใช้เครื่องมือของ Cowork ภายใน working folder ที่ผู้เรียนกดอนุญาตตอนเริ่มงาน

ผู้เรียนไม่ต้องเลือก Vault ซ้ำใน Extension การตีความการประชุม การสกัดมติและงานที่ต้องทำ การดูตัวอย่างก่อนบันทึก และสรุปรายสัปดาห์อยู่ใน Skill ของคอร์ส

v1 ไม่มี credential, remote sync หรือ cloud vault และ UI ไม่เข้าถึงไฟล์โดยตรง

## Requirements

- Node.js 20+
- macOS หรือ Windows พร้อม Claude Cowork และ Starter Vault ในเครื่อง
- Obsidian เป็นหน้าดู Vault แบบ optional ไม่ต้องเปิด Obsidian CLI

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
`dist/pir2-academy-obsidian-vault-0.2.6.mcpb` and prints its SHA-256 checksum.
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

The repository retains the previously hardened vault-tool modules as tested library code,
but the learner production server intentionally exposes only the interactive UI tool.
The current verified state is recorded in `docs/LIVE.md`; test evidence is in `docs/TESTING.md`.
