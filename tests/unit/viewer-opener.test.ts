import { describe, expect, it } from "vitest";
import { platformCommand } from "../../src/obsidian/viewer-opener.js";

describe("optional Obsidian viewer opener", () => {
  const uri = "obsidian://open?vault=starter-vault&file=note.md";

  it("uses argument arrays and no shell-specific command string on macOS", () => {
    expect(platformCommand(uri, "darwin", {})).toEqual({ command: "/usr/bin/open", args: [uri] });
  });

  it("uses the Windows system directory and preserves the URI as one argument", () => {
    expect(platformCommand(uri, "win32", { SystemRoot: "D:\\Windows" })).toEqual({
      command: "D:\\Windows\\System32\\rundll32.exe",
      args: ["url.dll,FileProtocolHandler", uri]
    });
  });
});
