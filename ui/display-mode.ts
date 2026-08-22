export type SecondBrainDisplayMode = "inline" | "fullscreen" | "pip";

type HostContext = {
  displayMode?: SecondBrainDisplayMode;
  availableDisplayModes?: SecondBrainDisplayMode[];
};

type RequestDisplayMode = (
  params: { mode: SecondBrainDisplayMode }
) => Promise<{ mode: SecondBrainDisplayMode }>;

export const SECOND_BRAIN_APP_CAPABILITIES = {
  availableDisplayModes: ["inline", "fullscreen"]
} as const;

export async function requestWorkspaceDisplayMode(
  hostContext: HostContext | undefined,
  requestDisplayMode: RequestDisplayMode
): Promise<SecondBrainDisplayMode> {
  const currentMode = hostContext?.displayMode ?? "inline";
  if (currentMode === "fullscreen") return currentMode;
  if (!hostContext?.availableDisplayModes?.includes("fullscreen")) return currentMode;

  try {
    return (await requestDisplayMode({ mode: "fullscreen" })).mode;
  } catch {
    return currentMode;
  }
}
