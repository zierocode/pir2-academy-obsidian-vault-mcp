import { describe, expect, it } from "vitest";
import { inspectSourcePolicy } from "../../src/source/source-policy.js";

const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);

describe("source policy", () => {
  it.each([
    ["โจทย์ธุรกิจ.docx", zip, "word", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["งบประมาณ.xlsx", zip, "excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["แผนงาน.pptx", zip, "powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["ข้อเสนอ.pdf", Buffer.from("%PDF-1.7\n"), "pdf", "application/pdf"],
    ["ภาพ.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image", "image/png"],
    ["ภาพ.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image", "image/jpeg"],
    ["เสียง.wav", Buffer.from("RIFF0000WAVE"), "audio", "audio/wav"],
    ["เสียง.mp3", Buffer.from("ID3\u0004"), "audio", "audio/mpeg"],
    ["เสียง.m4a", Buffer.from("0000ftypM4A "), "audio", "audio/mp4"],
    ["ถอดเสียง.txt", Buffer.from("สวัสดี", "utf8"), "text", "text/plain"],
    ["โน้ต.md", Buffer.from("# โน้ต", "utf8"), "text", "text/markdown"]
  ])("accepts %s as %s", (name, bytes, family, mime) => {
    expect(inspectSourcePolicy(name, bytes)).toMatchObject({ accepted: true, family, mime });
  });

  it.each(["macro.docm", "macro.xlsm", "macro.pptm", "archive.zip", "run.exe", "owner.~$draft.docx"])(
    "rejects unsafe source %s",
    (name) => {
      expect(inspectSourcePolicy(name, zip)).toMatchObject({ accepted: false, reason: "unsupported" });
    }
  );

  it("rejects an extension and magic mismatch", () => {
    expect(inspectSourcePolicy("ปลอม.pdf", Buffer.from("not a pdf"))).toMatchObject({
      accepted: false,
      reason: "signature_mismatch"
    });
  });

  it("rejects a source above the bounded file size", () => {
    expect(inspectSourcePolicy("ใหญ่.txt", Buffer.alloc(11), { maxBytes: 10 })).toMatchObject({
      accepted: false,
      reason: "limit_exceeded"
    });
  });
});
