import { describe, expect, it, vi } from "vitest";
import {
  SECOND_BRAIN_APP_CAPABILITIES,
  requestWorkspaceDisplayMode
} from "../../ui/display-mode.js";

describe("Second Brain display mode", () => {
  it("opens the workspace fullscreen when the Claude host supports it", async () => {
    const request = vi.fn().mockResolvedValue({ mode: "fullscreen" });

    await expect(
      requestWorkspaceDisplayMode(
        { displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"] },
        request
      )
    ).resolves.toBe("fullscreen");
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith({ mode: "fullscreen" });
  });

  it("keeps the inline fallback when fullscreen is unavailable", async () => {
    const request = vi.fn();

    await expect(
      requestWorkspaceDisplayMode(
        { displayMode: "inline", availableDisplayModes: ["inline"] },
        request
      )
    ).resolves.toBe("inline");
    expect(request).not.toHaveBeenCalled();
  });

  it("declares inline and fullscreen as supported app surfaces", () => {
    expect(SECOND_BRAIN_APP_CAPABILITIES).toEqual({
      availableDisplayModes: ["inline", "fullscreen"]
    });
  });
});
