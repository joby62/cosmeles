import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const sourceDir = path.resolve(frontendRoot, "..", "shared", "mobile", "decision");
const outputDir = path.join(frontendRoot, "generated", "mobile", "decision");

async function main() {
  await mkdir(outputDir, { recursive: true });
  if (!(await pathExists(sourceDir))) {
    const generatedEntries = await listGeneratedEntries();

    if (generatedEntries.length > 0) {
      console.warn(
        `[sync:mobile-decision] ${sourceDir} not found; reusing committed generated snapshot in ${outputDir}.`,
      );
      return;
    }

    throw new Error(
      `shared decision configs missing at ${sourceDir}, and no generated snapshot found at ${outputDir}`,
    );
  }

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

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listGeneratedEntries() {
  if (!(await pathExists(outputDir))) {
    return [];
  }

  return (await readdir(outputDir)).filter((name) => name.endsWith(".ts")).sort();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
