import { loadEnvFile } from "./extract-epds/io";
import { parseArgs } from "./extract-epds/options";
import { extractPdfsToRawJson } from "./extract-epds/raw-pdf";
import { convertRawJsonWithSchema } from "./extract-epds/schema-json";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadEnvFile();

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing LLM_API_KEY.");
  }

  if (!options.skipRawExtract) {
    await extractPdfsToRawJson(options);
  }

  await convertRawJsonWithSchema(options, apiKey);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
