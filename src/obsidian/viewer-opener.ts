import { spawn } from "node:child_process";
import { win32 } from "node:path";

export function platformCommand(
  uri: string,
  platform: NodeJS.Platform = process.platform,
  environment: Record<string, string | undefined> = process.env
): { command: string; args: string[] } {
  if (platform === "darwin") return { command: "/usr/bin/open", args: [uri] };
  if (platform === "win32") {
    const systemRoot = environment.SystemRoot?.trim() || "C:\\Windows";
    return {
      command: win32.join(systemRoot, "System32", "rundll32.exe"),
      args: ["url.dll,FileProtocolHandler", uri]
    };
  }
  return { command: "xdg-open", args: [uri] };
}

export async function openObsidianViewer(uri: string): Promise<void> {
  const { command, args } = platformCommand(uri);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true, shell: false });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
