import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, basename, extname } from "path";
import { parseWorkout } from "../../dsl/parser.ts";

const INPUT_DIR = new URL("input/", import.meta.url).pathname;
const OUTPUT_DIR = new URL("output/", import.meta.url).pathname;

mkdirSync(OUTPUT_DIR, { recursive: true });

const files = readdirSync(INPUT_DIR).filter((f) => extname(f) === ".txt").sort();
if (files.length === 0) {
  console.log("No .txt files found in tests/dsl/input/");
  process.exit(0);
}

for (const file of files) {
  const text = readFileSync(join(INPUT_DIR, file), "utf8");
  const result = parseWorkout(text);
  const outPath = join(OUTPUT_DIR, basename(file, ".txt") + ".json");
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  const warnCount = result.warnings.length;
  console.log(
    `${file} → ${outPath}${warnCount ? `  (${warnCount} warning${warnCount > 1 ? "s" : ""})` : ""}`,
  );
}
