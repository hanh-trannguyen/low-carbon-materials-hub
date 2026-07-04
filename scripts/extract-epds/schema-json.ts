import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { epdSchema, lifecycleModules } from "../../src/shared/epd/schema";
import {
  isObject,
  loadEnvFile,
  readJson,
  runWithConcurrency,
  writeJson,
} from "./io";
import { parseArgs } from "./options";
import { buildLlmRawPayload } from "./raw-pdf";
import type { ChatMessage, CliOptions, JsonObject } from "./types";

function expectedJsonExample(sourcePdf: string, epdId: string): JsonObject {
  return {
    id: epdId,
    sourcePdf,
    productName: "string",
    manufacturer: "string",
    declaredUnit: "string or null",
    manufacturingLocation: "string or null",
    compressiveStrength: {
      value: "number or null",
      unit: "string or null",
      status: "reported | not_declared | not_found | ambiguous",
      source: {
        page: 1,
        quote: "short exact quote",
      },
    },
    lifeCycleGwp: [
      {
        module: "A1-A3",
        value: "number or null",
        unit: "string or null",
        status: "reported | not_declared | not_found | ambiguous",
        source: {
          page: 1,
          quote:
            "Table title naming Product stage (A1-A3); GWP-total row with value and unit",
        },
        verification: {
          status: "supported | contradicted | not_found | ambiguous",
          confidence: 0.9,
        },
      },
    ],
    comparabilityNotes: ["string"],
    dataQualityFlags: ["string"],
  };
}

function textFrom(value: JsonObject, key: string) {
  const item = value[key];
  return typeof item === "string" ? item : "";
}

function compactEvidence(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function hasProductStageEvidence(quote: string) {
  return /product\s+stage|cradle[-\s]?to[-\s]?gate|A1\s*[-–]\s*A3|(?:primary|core)\s+environmental\s+(?:impact\s+)?indicators/i.test(
    quote,
  );
}

function hasGwpTotalEvidence(quote: string) {
  return /GWP\s*[-–]?\s*(?:total|tot)(?:\b|\d)|GWPt\b|global\s+warming\s+potential\s*[-–]?\s*total/i.test(
    quote,
  );
}

function hasForbiddenEvidence(quote: string) {
  const hasForbiddenTerm = /additional|resource\s+use|waste|output\s+flows?|distribution\s+stage|transport\s+to\s+site|construction\s+stage|end[-\s]?of\s?life/i.test(
    quote,
  );
  if (hasForbiddenTerm) {
    return true;
  }
  if (/GWP\s*[-–]?\s*(?:fossil|biogenic|luluc|ghg)\b/i.test(quote)) {
    return !hasGwpTotalEvidence(quote);
  }
  return false;
}

function validReportedQuote(quote: string) {
  return (
    hasProductStageEvidence(quote) &&
    hasGwpTotalEvidence(quote) &&
    !hasForbiddenEvidence(quote)
  );
}

function findLastPatternIndex(text: string, patterns: RegExp[], before: number) {
  let foundIndex = -1;
  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g")
      ? pattern.flags
      : `${pattern.flags}g`;
    const re = new RegExp(pattern.source, flags);
    for (const match of text.matchAll(re)) {
      const index = match.index ?? -1;
      if (index >= 0 && index < before && index > foundIndex) {
        foundIndex = index;
      }
    }
  }
  return foundIndex;
}

function textEvidence(text: string) {
  const compact = compactEvidence(text);
  if (!compact) {
    return [];
  }

  const candidates: string[] = [];
  const gwpRowPattern =
    /GWP\s*[-–]?\s*(?:total|tot)(?:\b|\d)[\s\S]*?(?=\s+GWP\s*[-–]?\s*(?:fossil|biogenic|luluc|ghg)\b|\s+(?:ODP|AP|EP[-\s]?[FMT]|POCP|ADPE|ADPF|WDP|RESOURCE\s+USE\s+PARAMETERS)\b|$)/gi;

  for (const rowMatch of compact.matchAll(gwpRowPattern)) {
    const rowIndex = rowMatch.index ?? 0;
    const headerStart = findLastPatternIndex(
      compact,
      [
        /PRIMARY\s+ENVIRONMENTAL\s+INDICATORS/i,
        /PRODUCT\s+STAGE/i,
        /CORE\s+ENVIRONMENTAL\s+(?:IMPACT\s+)?INDICATORS/i,
      ],
      rowIndex,
    );
    if (headerStart < 0) {
      continue;
    }

    const header = compact.slice(headerStart, rowIndex).trim();
    const row = compactEvidence(rowMatch[0]);
    const quote = compactEvidence(`${header}; ${row}`);
    if (validReportedQuote(quote)) {
      candidates.push(quote);
    }
  }

  return candidates;
}

function tableEvidence(markdown: string) {
  const rows = markdown
    .split("\n")
    .map((row) => row.replace(/\*\*/g, "").replace(/<br>/g, " "))
    .map(compactEvidence)
    .filter(Boolean);
  if (rows.length === 0) {
    return [];
  }

  const header =
    rows.find((row) => /A1\s*[-–]\s*A3|product\s+stage/i.test(row)) ?? "";
  return rows
    .filter(hasGwpTotalEvidence)
    .map((row) => compactEvidence([header, row].filter(Boolean).join("; ")));
}

function evidenceCandidates(rawPayload: JsonObject, pageNumber: number) {
  const pages = Array.isArray(rawPayload.pages)
    ? rawPayload.pages.filter(isObject)
    : [];
  const sourcePage = pages.find((page) => page.page === pageNumber);
  if (!sourcePage) {
    return [];
  }

  const candidates: string[] = [];
  const blocks = Array.isArray(sourcePage.blocks)
    ? sourcePage.blocks.filter(isObject)
    : [];
  for (const block of blocks) {
    candidates.push(compactEvidence(textFrom(block, "text")));
  }
  candidates.push(...textEvidence(textFrom(sourcePage, "text")));

  const tables = Array.isArray(sourcePage.tables)
    ? sourcePage.tables.map((table) => {
        if (typeof table === "string") {
          return { markdown: table };
        }
        return isObject(table) ? table : null;
      }).filter(isObject)
    : [];
  for (const table of tables) {
    const markdown = textFrom(table, "markdown");
    candidates.push(...tableEvidence(markdown));
  }

  return candidates.filter(validReportedQuote);
}

function allEvidenceCandidates(rawPayload: JsonObject) {
  const pages = Array.isArray(rawPayload.pages)
    ? rawPayload.pages.filter(isObject)
    : [];
  return pages.flatMap((page) => {
    const pageNumber = page.page;
    return typeof pageNumber === "number"
      ? evidenceCandidates(rawPayload, pageNumber)
      : [];
  });
}

function normalizeIdentity(
  candidate: JsonObject,
  rawPayload: JsonObject,
  fallbackId: string,
) {
  candidate.id =
    typeof rawPayload.id === "string" && rawPayload.id
      ? rawPayload.id
      : fallbackId;
  candidate.sourcePdf =
    typeof rawPayload.sourcePdf === "string" ? rawPayload.sourcePdf : "";
}

function normalizeReportedEvidence(
  candidate: JsonObject,
  rawPayload: JsonObject,
) {
  const lifeCycleGwp = Array.isArray(candidate.lifeCycleGwp)
    ? candidate.lifeCycleGwp.filter(isObject)
    : [];

  for (const item of lifeCycleGwp) {
    if (
      item.module !== "A1-A3" ||
      item.status !== "reported" ||
      !isObject(item.source)
    ) {
      continue;
    }

    const quote = textFrom(item.source, "quote");
    if (validReportedQuote(quote)) {
      continue;
    }

    const page = item.source.page;
    if (typeof page !== "number") {
      continue;
    }

    const [replacement] = evidenceCandidates(rawPayload, page);
    const [fallbackReplacement] = replacement
      ? []
      : allEvidenceCandidates(rawPayload);
    const quoteReplacement = replacement ?? fallbackReplacement;
    if (quoteReplacement) {
      item.source.quote = quoteReplacement;
    }
  }
}

export function buildSchemaConversionMessages(
  schemaText: string,
  rawPayload: JsonObject,
  retryNote: string | null,
): ChatMessage[] {
  const sourcePdf =
    typeof rawPayload.sourcePdf === "string" ? rawPayload.sourcePdf : "";
  const epdId = typeof rawPayload.id === "string" ? rawPayload.id : "";
  const userPayload: JsonObject = {
    task: "Convert this raw extraction JSON into one JSON object that exactly follows schema.ts.",
    schemaTs: schemaText,
    requiredLifecycleModules: [...lifecycleModules],
    rawExtractionJson: rawPayload,
    outputJsonExample: expectedJsonExample(sourcePdf, epdId),
    rules: [
      "For declaredUnit, read the declared/functional unit that belongs to the GWP or Product stage environmental indicator table. Prefer text in the table title, caption, header, nearby paragraph, or metadata immediately before/after the GWP-total table. Do not use an unrelated product mass, packaging unit, density unit, reference service life unit, or generic comparability note from elsewhere in the document.",
      "Normalize declaredUnit variants for concrete to '1 m3' when the nearby GWP table evidence says '1 m3', '1 m³', 'one cubic metre', '1 cubic metre', or '1 m3 of Ready Mix concrete at the batching plant gate'. If the GWP table clearly uses a different declared/functional unit such as '1 kg', keep that exact unit instead of converting it.",
      "If multiple declared/functional units appear, choose the one physically closest to the GWP-total/Product stage A1-A3 table. If no declared/functional unit can be tied to the GWP table evidence, set declaredUnit to null.",
      "If the compressive strength is not explicitly labeled in a table, but is clearly mentioned in the product name, mix code, or product description (e.g., '25 MPa', '32 MPa', 'S32', 'N32', 'VE322EAMF'), extract the numeric value (e.g., 25, 32) and unit 'MPa' and set the status to 'reported'.",
    ],
  };
  if (retryNote) {
    userPayload.retryNote = retryNote;
  }

  return [
    {
      role: "system",
      content:
        "You convert raw PDF extraction data into a single Environmental Product Declaration JSON object. Return only valid json. Do not include markdown or text outside the json object. Use the raw extraction evidence only. Do not guess values that are not supported by the evidence. ND, missing, not declared, and blank lifecycle modules must not be treated as zero. Use GWP-total, not Additional environmental impact indicators. Note: GWP values for A1-A3, A4, and A5 must be non-negative (>= 0); watch out for OCR reading column dividers, table borders, hyphens, or dashes as minus signs.\n" +
        "CRITICAL: Do not output \"status\": \"reported\" for any lifecycle module or compressive strength unless you have successfully extracted a valid, non-null numeric value, unit, and source page/quote. If the value is missing, ambiguous, or cannot be determined as a single number, set the status to \"not_found\", \"not_declared\", or \"ambiguous\" and set the value, unit, and source to null.\n" +
        "For declaredUnit, use the declared or functional unit tied to the GWP-total/Product stage environmental indicator table, prioritizing nearby table titles, captions, headers, and immediately adjacent text. Do not pick unrelated units from product descriptions, packaging, density, service life, or generic comparability text.\n" +
        "For compressive strength, if it is not explicitly labeled in a table, check the product name or product description for explicit strength grade indicators (e.g., \"25 MPa\", \"32 MPa\", \"S32\", \"N32\") and extract the numeric value and unit 'MPa'.",
    },
    { role: "user", content: JSON.stringify(userPayload) },
  ];
}

async function callLlmApi(
  options: CliOptions,
  messages: ChatMessage[],
  apiKey: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout * 1000);

  try {
    const response = await fetch(
      `${options.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature: 0,
          max_tokens: options.maxTokens,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `LLM API returned ${response.status}: ${await response.text()}`,
      );
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("LLM API returned empty content");
    }

    const parsed = JSON.parse(content) as unknown;
    if (!isObject(parsed)) {
      throw new Error("LLM API returned JSON that is not an object");
    }
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

export function validateEpd(candidate: unknown) {
  const parsed = epdSchema.safeParse(candidate);
  const errors = parsed.success
    ? []
    : parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
  if (parsed.success) {
    const modules = parsed.data.lifeCycleGwp.map((item) => item.module);
    const missing = lifecycleModules.filter(
      (module) => !modules.includes(module),
    );
    const extras = modules.filter(
      (module, index) => modules.indexOf(module) !== index,
    );
    if (missing.length > 0) {
      errors.push(`lifeCycleGwp is missing modules: ${missing.join(", ")}`);
    }
    if (extras.length > 0) {
      errors.push(
        `lifeCycleGwp has duplicate modules: ${[...new Set(extras)].join(", ")}`,
      );
    }
    for (const item of parsed.data.lifeCycleGwp) {
      if (
        item.module !== "A1-A3" ||
        item.status !== "reported" ||
        !item.source
      ) {
        continue;
      }

      const quote = item.source.quote;
      if (!hasProductStageEvidence(quote)) {
        errors.push(
          `${item.module} reported source.quote must identify Product stage A1-A3 or Primary Environmental Indicators`,
        );
      }
      if (!hasGwpTotalEvidence(quote)) {
        errors.push(
          `${item.module} reported source.quote must identify GWP-total`,
        );
      }
      if (hasForbiddenEvidence(quote)) {
        errors.push(
          `${item.module} reported source.quote contains forbidden non-product-stage or Additional evidence`,
        );
      }
    }
  }
  return errors;
}

async function listRawJsonFiles(options: CliOptions) {
  let rawFiles = (await fs.readdir(options.rawOutput))
    .filter((file) => file.endsWith(".json"))
    .sort();
  if (options.ids.length > 0) {
    const ids = new Set(options.ids);
    rawFiles = rawFiles.filter((file) => ids.has(path.basename(file, ".json")));
  }
  if (options.pdfs.length > 0) {
    const pdfIds = new Set(options.pdfs.map(pdfId));
    rawFiles = rawFiles.filter((file) => pdfIds.has(path.basename(file, ".json")));
  }
  if (options.limit !== null) {
    rawFiles = rawFiles.slice(0, options.limit);
  }
  if (rawFiles.length === 0) {
    throw new Error(
      `No raw extraction JSON files found in ${options.rawOutput}`,
    );
  }

  return rawFiles;
}

function pdfId(pdfPath: string) {
  return path
    .basename(pdfPath, path.extname(pdfPath))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function convertRawJsonFile(
  options: CliOptions,
  schemaText: string,
  apiKey: string,
  file: string,
) {
  const rawPath = path.join(options.rawOutput, file);
  const raw = await readJson(rawPath);
  if (!isObject(raw)) {
    throw new Error("raw extraction must be an object");
  }

  const rawPayload = buildLlmRawPayload(raw, options);
  const epdId =
    typeof rawPayload.id === "string" && rawPayload.id
      ? rawPayload.id
      : path.basename(file, ".json");
  const outputPath = path.join(options.output, `${epdId}.json`);
  if (!options.overwrite) {
    try {
      await fs.access(outputPath);
      throw new Error(`${outputPath} exists; pass --overwrite to replace it`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  let result: JsonObject | null = null;
  let retryNote: string | null = null;
  let lastError: unknown = null;
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      result = await callLlmApi(
        options,
        buildSchemaConversionMessages(schemaText, rawPayload, retryNote),
        apiKey,
      );
      normalizeIdentity(result, rawPayload, epdId);
      normalizeReportedEvidence(result, rawPayload);
      const errors = validateEpd(result);
      if (errors.length > 0) {
        retryNote = `Previous JSON parsed, but failed schema validation: ${errors.join("; ")}`;
        if (attempt < maxAttempts - 1) {
          continue;
        }
      }
      break;
    } catch (error) {
      lastError = error;
      retryNote = `Previous response failed to parse or validate as json: ${(error as Error).message}`;
      if (attempt < maxAttempts - 1) {
        continue;
      }
    }
  }

  if (!result) {
    throw new Error(
      `LLM API conversion failed: ${(lastError as Error | null)?.message ?? "unknown error"}`,
    );
  }

  const errors = validateEpd(result);
  if (errors.length > 0) {
    throw new Error(
      `schema validation failed after retry: ${errors.join("; ")}`,
    );
  }

  await writeJson(outputPath, result);
  return outputPath;
}

export async function convertRawJsonWithSchema(
  options: CliOptions,
  apiKey: string,
) {
  const schemaText = await fs.readFile(options.schema, "utf8");
  await fs.mkdir(options.output, { recursive: true });
  const rawFiles = await listRawJsonFiles(options);

  const failures: string[] = [];
  await runWithConcurrency(rawFiles, options.rawConcurrency, async (file) => {
    try {
      const outputPath = await convertRawJsonFile(
        options,
        schemaText,
        apiKey,
        file,
      );
      console.log(`converted ${file} -> ${outputPath}`);
    } catch (error) {
      const message = `${file}: ${(error as Error).message}`;
      failures.push(message);
      console.error(message);
    }
  });

  if (failures.length > 0) {
    console.error("\n--- Conversion Failures ---");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    console.error("---------------------------\n");
    throw new Error(
      `Completed with ${failures.length} failure(s):\n${failures.map((f) => `- ${f}`).join("\n")}`,
    );
  }

  console.log(
    `Converted ${rawFiles.length} raw extraction files to ${options.output}.`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadEnvFile();

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing LLM_API_KEY.");
  }

  if (process.env.LLM_API_URL && !process.argv.includes("--base-url")) {
    options.baseUrl = process.env.LLM_API_URL;
  }

  await convertRawJsonWithSchema(options, apiKey);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
