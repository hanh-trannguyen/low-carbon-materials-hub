import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { CliOptions, JsonObject, JsonValue } from "./types";
import { isObject, runWithConcurrency } from "./io";

function compactText(text: string, maxLength: number) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

function readString(value: JsonObject, key: string) {
  const item = value[key];
  return typeof item === "string" ? item : "";
}

function readArray(value: JsonObject, key: string) {
  const item = value[key];
  return Array.isArray(item) ? item : [];
}

function tablePayload(table: JsonObject, maxTableRows: number): JsonObject {
  const rows = readArray(table, "rows").slice(0, maxTableRows) as JsonValue[];
  return {
    index: table.index ?? null,
    strategy: table.strategy ?? null,
    rowCount: table.rowCount ?? null,
    colCount: table.colCount ?? null,
    rows,
    markdown: table.markdown ?? null
  };
}

function blockPayload(block: JsonObject, maxChars: number): JsonObject {
  return {
    text: compactText(readString(block, "text"), maxChars)
  };
}

export function buildLlmRawPayload(raw: JsonObject, options: CliOptions): JsonObject {
  let rawPages = readArray(raw, "pages").filter(isObject);
  if (options.maxPages !== null) {
    rawPages = rawPages.slice(0, options.maxPages);
  }

  const pages = rawPages.map((page) => {
    const tables = readArray(page, "tables")
      .map((table) => {
        if (typeof table === "string") {
          return { markdown: table };
        }
        return isObject(table) ? tablePayload(table, options.maxTableRows) : null;
      })
      .filter(isObject)
      .slice(0, options.maxTablesPerPage);
    const blocks = readArray(page, "blocks")
      .filter(isObject)
      .slice(0, options.maxBlocksPerPage)
      .map((block) => blockPayload(block, options.maxBlockChars));

    return {
      page: page.page ?? null,
      width: page.width ?? null,
      height: page.height ?? null,
      text: compactText(readString(page, "text"), options.maxPageChars),
      blocks,
      tables
    };
  });

  return {
    id: raw.id ?? null,
    sourcePdf: raw.sourcePdf ?? raw.id ?? null,
    pageCount: raw.pageCount ?? null,
    extractor: raw.extractor ?? null,
    warnings: raw.warnings ?? null,
    pages
  };
}

export async function extractPdfsToRawJson(options: CliOptions) {
  const pdfFiles = await resolvePdfFiles(options);

  if (pdfFiles.length === 0) {
    throw new Error(`No PDF files found in ${options.pdfDir}`);
  }

  await runWithConcurrency(pdfFiles, options.rawConcurrency, (pdf) => extractPdfToRawJson(options, pdf));
}

async function resolvePdfFiles(options: CliOptions) {
  const pdfs = options.pdfs.length > 0 ? options.pdfs : await listPdfFiles(options.pdfDir);
  return options.limit !== null ? pdfs.slice(0, options.limit) : pdfs;
}

async function listPdfFiles(pdfDir: string) {
  const entries = await readdir(pdfDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => entry.name)
    .sort();
}

async function extractPdfToRawJson(options: CliOptions, pdf: string) {
  const args = [
    "run",
    "python",
    "scripts/extract_raw_pdf.py",
    "--input",
    options.pdfDir,
    "--output",
    options.rawOutput,
    "--pdf",
    pdf,
    "--ocr-dpi",
    String(options.ocrDpi)
  ];

  await new Promise<void>((resolve, reject) => {
    console.log(`extracting raw OCR: ${path.basename(pdf)}`);
    const child = spawn("uv", args, { cwd: process.cwd(), stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Raw OCR extractor exited with code ${code} for ${pdf}`));
      }
    });
  });
}
