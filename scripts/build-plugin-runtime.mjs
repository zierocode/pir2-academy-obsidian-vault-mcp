import { mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseOutputPath(argv) {
  const index = argv.indexOf("--outfile");
  const value = index >= 0 ? argv[index + 1]?.trim() : "";
  if (!value || argv.filter((argument) => argument === "--outfile").length !== 1) {
    throw new Error("exactly one --outfile path is required");
  }
  return resolve(value);
}

function main() {
  const outputPath = parseOutputPath(process.argv.slice(2));
  mkdirSync(dirname(outputPath), { recursive: true });
  buildSync({
    entryPoints: [resolve(ROOT, "src/index.ts")],
    outfile: outputPath,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    banner: {
      js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'
    },
    sourcemap: false,
    legalComments: "none",
    logLevel: "silent"
  });
  process.stdout.write(`plugin-runtime=${outputPath} bytes=${statSync(outputPath).size}\n`);
}

try {
  main();
} catch {
  process.stderr.write("plugin runtime build failed\n");
  process.exitCode = 1;
}
