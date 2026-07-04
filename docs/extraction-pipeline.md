# Extraction Pipeline

## Goal

The extraction pipeline converts the PDF files in `Resources/` into validated JSON files in `data/`. It is designed to preserve provenance and avoid inventing carbon values when PDF evidence is missing or ambiguous.

## Commands

```bash
npm run extract
npm run validate:data
npm run convert:schema
```

`npm run build` also runs `npm run validate:data` before `next build`.

## Environment

The end-to-end extractor needs an LLM API key:

```bash
LLM_API_KEY=...
```

Optional settings:

```bash
LLM_MODEL=deepseek-v4-flash
LLM_API_URL=https://api.deepseek.com
OCR_DPI=200
```

`scripts/extract-epds/io.ts` loads `.env` if present and does not override existing environment variables.

## Pipeline Stages

### 1. Parse CLI Options

`scripts/extract-epds/options.ts` defines defaults and supported flags:

- input PDFs: `--pdf-dir`, `--pdf`;
- raw output: `--raw-output`;
- final output: `--output`;
- schema path: `--schema`;
- model/API settings: `--model`, `--base-url`, `--max-tokens`, `--timeout`;
- processing scope: `--limit`, `--id`, `--skip-raw-extract`;
- OCR and compaction: `--ocr-dpi`, `--raw-concurrency`, `--max-pages`, `--max-page-chars`, `--max-tables-per-page`, `--max-table-rows`, `--max-blocks-per-page`, `--max-block-chars`;
- overwrite behavior: `--overwrite`, `--no-overwrite`.

### 2. Raw PDF OCR

`scripts/extract-epds/raw-pdf.ts` resolves PDF filenames and spawns:

```bash
uv run python scripts/extract_raw_pdf.py
```

`scripts/extract_raw_pdf.py` uses PyMuPDF and Tesseract:

1. open each PDF;
2. process each page;
3. prefer native text only if it appears to contain enough table numbers;
4. render page images at the configured DPI;
5. run Tesseract OCR with page segmentation modes tuned for regular pages and rotated tables;
6. score OCR outputs using EPD keywords, numeric density, scientific notation, and text quality;
7. write one raw JSON file per PDF to `.extraction-raw/`.

The raw JSON contains:

```json
{
  "id": "slugified-pdf-name",
  "sourcePdf": "Resources/example.pdf",
  "pages": [
    { "page": 1, "text": "..." }
  ]
}
```

### 3. Build LLM Payload

`buildLlmRawPayload()` in `scripts/extract-epds/raw-pdf.ts` compacts raw extraction output before it is sent to the LLM.

It can include page text, blocks, and table payloads when present. The current Python extractor writes page text only, but the TypeScript compaction code supports richer raw extractors.

### 4. Convert Raw Evidence to Schema JSON

`scripts/extract-epds/schema-json.ts` sends the schema text, compacted raw evidence, lifecycle modules, rules, and an example output object to the LLM.

The prompt rules emphasize:

- return one JSON object only;
- use raw evidence only;
- do not guess unsupported values;
- do not treat ND, missing, or blank modules as zero;
- use `GWP-total`, not Additional environmental indicators;
- avoid negative values for A1-A3, A4, and A5;
- extract compressive strength from explicit labels or clear strength grade indicators.

### 5. Normalize and Validate

After each LLM response:

1. JSON is parsed.
2. `id` and `sourcePdf` are normalized from the raw payload.
3. A1-A3 source quotes are repaired from nearby evidence if possible.
4. `validateEpd()` runs the shared Zod schema and extra module checks.
5. Failed responses are retried up to four attempts with validation errors included as retry notes.
6. Valid JSON is written to `data/{id}.json`.

If any file fails conversion, the command reports all failures and exits non-zero.

## A1-A3 Evidence Rules

A1-A3 has stricter validation than other modules because it is the most important product-stage comparison value. A reported A1-A3 quote must:

- identify Product stage, cradle-to-gate, A1-A3, Primary Environmental Indicators, or Core Environmental Indicators;
- identify `GWP-total` or equivalent wording;
- avoid Additional indicators, resource use, waste, distribution stage, construction stage, transport-to-site, end-of-life evidence, and non-total GWP variants such as fossil/biogenic/LULUC/GHG unless total evidence is present.

## Data Validation

`scripts/validate-data.ts` validates every file in `data/`:

- all files must parse through `epdSchema`;
- every required lifecycle module must appear;
- lifecycle modules must not be duplicated.

This command is used by the build script:

```json
"build": "npm run validate:data && next build"
```

## Failure Modes

### Missing Tesseract

The Python extractor exits with:

```text
Missing dependency: Tesseract must be installed and available on PATH.
```

Install Tesseract locally before running `npm run extract`.

### Missing LLM API Key

The orchestrator exits with:

```text
Missing LLM_API_KEY.
```

Set `LLM_API_KEY` in the shell or `.env`.

### Invalid Schema Output

If the LLM returns unsupported or incomplete JSON, `schema-json.ts` retries with validation errors. Persistent failures are reported at the end under `Conversion Failures`.

### Bad or Missing PDFs

The raw extractor validates that the input directory exists and requested PDF files exist before processing.

## Design Notes

- The extraction pipeline is offline so that runtime requests are fast and deterministic.
- Python is used only where PyMuPDF and Tesseract are needed.
- TypeScript owns orchestration and schema validation so extraction output matches the app contract.
- Every reported value must keep enough source evidence for later human review.
