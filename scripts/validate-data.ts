import { promises as fs } from "node:fs";
import path from "node:path";
import { epdSchema, lifecycleModules } from "../src/shared/epd/schema";

const dataDir = path.join(process.cwd(), "data");

const files = (await fs.readdir(dataDir))
  .filter((file) => file.endsWith(".json"))
  .sort();

if (files.length === 0) {
  throw new Error("No data/*.json files found. Run npm run extract first.");
}

for (const file of files) {
  const json = JSON.parse(await fs.readFile(path.join(dataDir, file), "utf8"));
  const epd = epdSchema.parse(json);
  const modules = epd.lifeCycleGwp.map((item) => item.module);
  const missing = lifecycleModules.filter((module) => !modules.includes(module));
  const duplicates = modules.filter((module, index) => modules.indexOf(module) !== index);

  if (missing.length > 0) {
    throw new Error(`${file}: lifeCycleGwp is missing modules: ${missing.join(", ")}`);
  }
  if (duplicates.length > 0) {
    throw new Error(`${file}: lifeCycleGwp has duplicate modules: ${[...new Set(duplicates)].join(", ")}`);
  }
}

console.log(`Validated ${files.length} EPD JSON files.`);
