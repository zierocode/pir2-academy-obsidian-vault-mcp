import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { IGNORED_DIRECTORIES, SECRET_PATTERNS } from "./secret-scan-policy.mjs";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function parseRoot(argv) {
  if (argv.length === 0) return process.cwd();
  if (argv.length === 2 && argv[0] === "--root") return resolve(argv[1]);
  throw new Error("usage: node scripts/scan-secrets.mjs [--root <directory>]");
}

function listedFiles(root, current = root) {
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) files.push(...listedFiles(root, path));
      continue;
    }
    if (entry.isFile() && lstatSync(path).size <= MAX_FILE_BYTES) files.push(path);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function findingsFor(root, file) {
  const content = readFileSync(file, "utf8");
  const path = relative(root, file).split(sep).join("/");
  const findings = [];
  for (const { name, expression } of SECRET_PATTERNS) {
    expression.lastIndex = 0;
    if (expression.test(content)) findings.push({ name, path });
  }
  return findings;
}

try {
  const root = parseRoot(process.argv.slice(2));
  if (!lstatSync(root).isDirectory()) throw new Error("scan root must be a directory");
  const findings = listedFiles(root).flatMap((file) => findingsFor(root, file));

  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`secret-like value: ${finding.path} [${finding.name}]`);
    }
    process.exitCode = 1;
  } else {
    console.log("secret scan passed");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "secret scan failed");
  process.exitCode = 1;
}
