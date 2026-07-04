# Operations

This runbook is a command reference for recurring tasks. For ordered setup workflows, see [Local Setup](./local-setup.md). For production hosting, see [Vercel Deployment](./vercel-deployment.md).

Run `npm install` once before using any `npm run ...` command if dependencies are not already installed.

## Command Reference

### Command Order

| Task | Command order | Notes |
| --- | --- | --- |
| Run app with existing data | `npm install` -> `npm run validate:data` -> `npm run dev` | Normal path. No Python, Tesseract, `uv`, `.env`, or `LLM_API_KEY` required. |
| Check production locally | `npm run build` -> `npm run start` | `npm run build` includes `npm run validate:data`. |
| Regenerate data from PDFs | `uv sync` -> set `LLM_API_KEY` -> `npm run extract` -> `npm run validate:data` | Optional extraction path only. |
| Convert existing raw OCR | set `LLM_API_KEY` -> `npm run convert:schema` -> `npm run validate:data` | Uses existing `.extraction-raw/*.json`; does not rerun OCR. |

`npm run extract` is not needed to view the app. It is only for regenerating data from PDF source files.

### `npm run dev`

Starts the Next.js development server, normally at `http://localhost:3000`.

### `npm run build`

Builds the production app. The build first runs:

```bash
npm run validate:data
```

This means invalid EPD JSON blocks production builds.

### `npm run start`

Starts the local production server after `npm run build`.

### `npm run validate:data`

Expected success output:

```text
Validated 20 EPD JSON files.
```

Run this after changing any file in `data/`.

### `npm run extract`

End-to-end optional extraction from PDFs into app JSON. This requires Python, `uv`, Tesseract, and `LLM_API_KEY`.

```bash
LLM_API_KEY=... npm run extract
```

Useful scoped runs:

```bash
npm run extract -- --limit 1
npm run extract -- --pdf EPD_HUB-5555_2026-06-27_en.pdf
npm run extract -- --skip-raw-extract --id epd-hub-5555-2026-06-27-en
```

### `npm run convert:schema`

Converts existing `.extraction-raw/*.json` files into validated files under `data/` without rerunning OCR. This still requires `LLM_API_KEY`.

```bash
LLM_API_KEY=... npm run convert:schema
```

## Important Files

```text
package.json                         npm scripts and JS dependencies
pyproject.toml                       Python extraction dependency
src/shared/epd/schema.ts             application data contract
scripts/validate-data.ts             build-time data validation
scripts/extract-epds.ts              extraction orchestrator
scripts/extract_raw_pdf.py           raw OCR extractor
data/*.json                          app data
Resources/*.pdf                      source PDFs for traceability
```

## Adding a New EPD

1. Place the PDF in `Resources/`.
2. Run extraction for that PDF:

   ```bash
   LLM_API_KEY=... npm run extract -- --pdf your-file.pdf
   ```

3. Validate data:

   ```bash
   npm run validate:data
   ```

4. Run the app and inspect source drawer links for reported values.

## Troubleshooting

### App setup or Vercel deployment questions

Use [Local Setup](./local-setup.md) for dependency installation and local run steps. Use [Vercel Deployment](./vercel-deployment.md) for deployment settings and smoke checks.

### `Missing LLM_API_KEY.`

Set `LLM_API_KEY` in the shell or in `.env`.

### `Missing dependency: Tesseract must be installed and available on PATH.`

Install Tesseract and ensure the `tesseract` command is available.

### Build fails during `validate:data`

Open the reported JSON file and check:

- every lifecycle module appears exactly once;
- reported values include `value`, `unit`, and `source`;
- non-reported values use `value: null`;
- A1-A3 source quotes identify Product stage/Core or Primary Environmental Indicators and GWP-total.

### PDF preview returns `404`

Check that `sourcePdf` in the JSON points to a real file under `Resources/`.

### PDF preview returns `400`

The PDF API rejects non-PDF extensions and path traversal attempts. Use only a PDF filename or a path starting with `Resources/`.

## Maintenance Guidelines

- Keep `src/shared/epd/schema.ts` as the single source of truth for app data.
- Run `npm run validate:data` after changing any file in `data/`.
- Update extraction prompt rules when schema fields change.
- Do not silently coerce missing lifecycle modules to zero.
- Preserve `source.page` and `source.quote` for every reported carbon value.
