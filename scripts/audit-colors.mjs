import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOTS = ["app", "components", "lib"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const PALETTE_NAMES = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const checks = [
  { name: "color literal", pattern: /(?<!&)#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(/i },
  { name: "Tailwind palette utility", pattern: new RegExp(`(?:^|\\s)(?:[\\w-]+:)*(?:bg|text|border|ring|outline|shadow|fill|stroke)-(?:${PALETTE_NAMES})(?:-|\\/|\\b)`, "i") },
  { name: "named inline color", pattern: new RegExp(`(?:backgroundColor|borderColor|color)\\s*:\\s*["'](?:${PALETTE_NAMES})["']`, "i") },
];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name)) && !entry.name.includes(".test.")) files.push(path);
  }
  return files;
}

const files = (await Promise.all(ROOTS.map(collect))).flat().filter((file) => relative(process.cwd(), file).replaceAll("\\", "/") !== "app/globals.css");
const failures = [];

for (const file of files) {
  const lines = (await readFile(file, "utf8")).split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of checks) {
      if (check.pattern.test(line)) failures.push(`${relative(process.cwd(), file)}:${index + 1} ${check.name}: ${line.trim()}`);
    }
  });
}

if (failures.length) {
  console.error("Application colors must use semantic variables from app/globals.css.\n");
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Color audit passed across ${files.length} application source files.`);
