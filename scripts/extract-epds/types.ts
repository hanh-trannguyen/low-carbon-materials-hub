export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type CliOptions = {
  pdfDir: string;
  rawOutput: string;
  output: string;
  schema: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  timeout: number;
  limit: number | null;
  ids: string[];
  pdfs: string[];
  overwrite: boolean;
  skipRawExtract: boolean;
  ocrDpi: number;
  rawConcurrency: number;
  maxPages: number | null;
  maxPageChars: number;
  maxTablesPerPage: number;
  maxTableRows: number;
  maxBlocksPerPage: number;
  maxBlockChars: number;
};

export type ChatMessage = {
  role: "system" | "user";
  content: string;
};
