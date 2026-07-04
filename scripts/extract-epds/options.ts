import type { CliOptions } from "./types";

function defaultOcrDpi() {
  const value = Number(process.env.OCR_DPI ?? 200);
  return Number.isFinite(value) ? value : 200;
}

const defaultOptions: CliOptions = {
  pdfDir: "Resources",
  rawOutput: ".extraction-raw",
  output: "data",
  schema: "src/shared/epd/schema.ts",
  model: process.env.LLM_MODEL ?? "deepseek-v4-flash",
  baseUrl: process.env.LLM_API_URL ?? "https://api.deepseek.com",
  maxTokens: 16000,
  timeout: 120,
  limit: null,
  ids: [],
  pdfs: [],
  overwrite: true,
  skipRawExtract: false,
  ocrDpi: defaultOcrDpi(),
  rawConcurrency: 2,
  maxPages: null,
  maxPageChars: 12000,
  maxTablesPerPage: 12,
  maxTableRows: 80,
  maxBlocksPerPage: 30,
  maxBlockChars: 500
};

export function parseArgs(argv: string[]) {
  const options: CliOptions = { ...defaultOptions, ids: [], pdfs: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };
    const numberNext = () => {
      const value = Number(next());
      if (!Number.isFinite(value)) {
        throw new Error(`${arg} requires a numeric value`);
      }
      return value;
    };

    switch (arg) {
      case "--pdf-dir":
        options.pdfDir = next();
        break;
      case "--raw-output":
        options.rawOutput = next();
        break;
      case "--output":
        options.output = next();
        break;
      case "--schema":
        options.schema = next();
        break;
      case "--model":
        options.model = next();
        break;
      case "--base-url":
        options.baseUrl = next();
        break;
      case "--max-tokens":
        options.maxTokens = numberNext();
        break;
      case "--timeout":
        options.timeout = numberNext();
        break;
      case "--limit":
        options.limit = numberNext();
        break;
      case "--id":
        options.ids.push(next());
        break;
      case "--pdf":
        options.pdfs.push(next());
        break;
      case "--overwrite":
        options.overwrite = true;
        break;
      case "--no-overwrite":
        options.overwrite = false;
        break;
      case "--skip-raw-extract":
        options.skipRawExtract = true;
        break;
      case "--ocr-dpi":
        options.ocrDpi = numberNext();
        if (options.ocrDpi < 72) {
          throw new Error("--ocr-dpi must be at least 72");
        }
        break;
      case "--raw-concurrency":
        options.rawConcurrency = numberNext();
        if (options.rawConcurrency < 1) {
          throw new Error("--raw-concurrency must be at least 1");
        }
        break;
      case "--max-pages":
        options.maxPages = numberNext();
        break;
      case "--max-page-chars":
        options.maxPageChars = numberNext();
        break;
      case "--max-tables-per-page":
        options.maxTablesPerPage = numberNext();
        break;
      case "--max-table-rows":
        options.maxTableRows = numberNext();
        break;
      case "--max-blocks-per-page":
        options.maxBlocksPerPage = numberNext();
        break;
      case "--max-block-chars":
        options.maxBlockChars = numberNext();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}
