export type SourceFamily = "word" | "excel" | "powerpoint" | "pdf" | "image" | "audio" | "text";

export type SourcePolicyResult =
  | { accepted: true; family: SourceFamily; mime: string }
  | { accepted: false; reason: "unsupported" | "signature_mismatch" | "limit_exceeded" };
