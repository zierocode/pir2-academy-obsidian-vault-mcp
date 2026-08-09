export const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "coverage",
  "dist",
  "server"
]);

export const SECRET_PATTERNS = [
  { name: "OpenAI-style API key", expression: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g },
  { name: "GitHub token", expression: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { name: "AWS access key", expression: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: "private key block", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "generic credential assignment", expression: /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{20,}/gi }
];
