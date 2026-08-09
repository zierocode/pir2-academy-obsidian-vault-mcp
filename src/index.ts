import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { runStdioServer } from "./server.js";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runStdioServer().catch(() => {
    process.stderr.write("เริ่ม Obsidian Vault MCP ไม่สำเร็จครับ โปรดตรวจการตั้งค่า Vault แล้วลองใหม่ครับ\n");
    process.exitCode = 1;
  });
}
