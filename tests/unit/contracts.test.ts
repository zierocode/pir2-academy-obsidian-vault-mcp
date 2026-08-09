import { describe, expect, it } from "vitest";

async function loadContracts(): Promise<Record<string, unknown> | undefined> {
  try {
    return (await import("../../src/contracts.js")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

describe("tool result envelope", () => {
  it("returns successful data in the stable envelope", async () => {
    const contracts = await loadContracts();
    const success = contracts?.success as ((message: string, data: unknown) => unknown) | undefined;

    expect(success).toBeDefined();
    expect(success?.("พร้อมอ่านโน้ต", { count: 1 })).toEqual({
      ok: true,
      code: "OK",
      message: "พร้อมอ่านโน้ต",
      data: { count: 1 }
    });
  });

  it("returns failures without a data payload", async () => {
    const contracts = await loadContracts();
    const failure = contracts?.failure as ((code: string, message: string) => unknown) | undefined;

    expect(failure).toBeDefined();
    expect(failure?.("INVALID_NOTE_PATH", "เส้นทางโน้ตไม่ปลอดภัย")).toEqual({
      ok: false,
      code: "INVALID_NOTE_PATH",
      message: "เส้นทางโน้ตไม่ปลอดภัย"
    });
  });
});
