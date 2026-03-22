import { cpSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const src = "src/rules";
const dest = "dist/rules";

mkdirSync(dest, { recursive: true });

for (const entry of readdirSync(src)) {
  const srcPath = join(src, entry);
  if (statSync(srcPath).isDirectory()) {
    cpSync(srcPath, join(dest, entry), { recursive: true });
  }
}

console.log("Rules copied to dist/rules/");
