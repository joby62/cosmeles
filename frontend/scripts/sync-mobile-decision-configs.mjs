import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const sourceDir = path.join(repoRoot, "shared", "mobile", "decision");
const outputDir = path.join(repoRoot, "frontend", "generated", "mobile", "decision");

async function main() {
  await mkdir(outputDir, { recursive: true });
  const entries = (await readdir(sourceDir)).filter((name) => name.endsWith(".json")).sort();

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry);
    const outputPath = path.join(outputDir, entry.replace(/\.json$/, ".ts"));
    const raw = await readFile(sourcePath, "utf8");
    const parsed = JSON.parse(raw);
    const content = `${header(entry)}const data = ${JSON.stringify(parsed, null, 2)} as const;\n\nexport default data;\n`;
    await writeFile(outputPath, content, "utf8");
  }
}

function header(name) {
  return `// Generated from shared/mobile/decision/${name}. Do not edit by hand.\n\n`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
