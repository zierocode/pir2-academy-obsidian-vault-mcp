import type { SourceFamily, SourcePolicyResult } from "./types.js";

const POLICY: Record<string, { family: SourceFamily; mime: string; signature?: (bytes: Uint8Array) => boolean }> = {
  ".docx": { family: "word", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: isZip },
  ".xlsx": { family: "excel", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", signature: isZip },
  ".pptx": { family: "powerpoint", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", signature: isZip },
  ".pdf": { family: "pdf", mime: "application/pdf", signature: (bytes) => ascii(bytes, 0, 5) === "%PDF-" },
  ".png": { family: "image", mime: "image/png", signature: isPng },
  ".jpg": { family: "image", mime: "image/jpeg", signature: isJpeg },
  ".jpeg": { family: "image", mime: "image/jpeg", signature: isJpeg },
  ".wav": { family: "audio", mime: "audio/wav", signature: isWav },
  ".mp3": { family: "audio", mime: "audio/mpeg", signature: isMp3 },
  ".m4a": { family: "audio", mime: "audio/mp4", signature: isM4a },
  ".txt": { family: "text", mime: "text/plain" },
  ".md": { family: "text", mime: "text/markdown" }
};

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

export function inspectSourcePolicy(
  name: string,
  bytes: Uint8Array,
  options: { maxBytes?: number; declaredSize?: number } = {}
): SourcePolicyResult {
  if ((options.declaredSize ?? bytes.byteLength) > (options.maxBytes ?? DEFAULT_MAX_BYTES)) {
    return { accepted: false, reason: "limit_exceeded" };
  }
  const basename = name.replaceAll("\\", "/").split("/").at(-1) ?? name;
  if (basename.includes("~$")) return { accepted: false, reason: "unsupported" };
  const dot = basename.lastIndexOf(".");
  const extension = dot >= 0 ? basename.slice(dot).toLowerCase() : "";
  const policy = POLICY[extension];
  if (!policy) return { accepted: false, reason: "unsupported" };
  if (policy.signature && !policy.signature(bytes)) {
    return { accepted: false, reason: "signature_mismatch" };
  }
  return {
    accepted: true,
    family: policy.family,
    mime: policy.mime
  };
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWav(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE";
}

function isMp3(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && (ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0));
}

function isM4a(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp";
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}
