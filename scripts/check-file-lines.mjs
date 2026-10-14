/** Fails when a source or test file exceeds 200 lines (docs/development-rules.md). */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const LIMIT = 200;
const ROOTS = ["src", "test", "e2e", "scripts"];
const EXT = /\.(ts|tsx|mjs|css)$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXT.test(name)) yield path;
  }
}

const offenders = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split("\n").length - 1;
    if (lines > LIMIT) offenders.push(`${file}: ${lines} lines`);
  }
}
if (offenders.length > 0) {
  console.error(`Files over ${LIMIT} lines:\n${offenders.join("\n")}`);
  process.exit(1);
}
console.log(`All files <= ${LIMIT} lines`);
