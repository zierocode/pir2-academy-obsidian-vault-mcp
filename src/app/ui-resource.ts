import { SECOND_BRAIN_RESOURCE_URI } from "./contracts.js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SECOND_BRAIN_RESOURCE = {
  uri: SECOND_BRAIN_RESOURCE_URI,
  name: "Second Brain Workspace",
  description: "Interactive workspace for project choices, knowledge review, sourced results and confirmation",
  mimeType: "text/html;profile=mcp-app"
} as const;

const FALLBACK_HTML = `<!doctype html>
<html lang="th">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Second Brain Workspace</title></head>
<body><main><h1>Second Brain Workspace</h1><p>กำลังเตรียมข้อมูลจาก Claude ครับ</p></main></body>
</html>`;

const bundledUi = resolve(dirname(fileURLToPath(import.meta.url)), "../app-ui/index.html");
export const SECOND_BRAIN_HTML = existsSync(bundledUi)
  ? readFileSync(bundledUi, "utf8")
  : FALLBACK_HTML;
