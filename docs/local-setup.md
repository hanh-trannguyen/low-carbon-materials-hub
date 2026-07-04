# Local Setup

This guide gives the exact local command order for each common workflow. Choose the path that matches your current task and run it top to bottom.

All workflows that use `npm run ...` require Node.js, npm, and the JavaScript dependencies from `npm install`. If `node_modules/` is not present yet, run `npm install` before the workflow commands.

## Use the App Only

Use this path when you want to view or work on the app with the existing JSON files in `data/`.

Requirements:

- Node.js;
- npm.

Run order:

```bash
npm install
npm run validate:data
npm run dev
```

Open `http://localhost:3000`. The app reads from `data/*.json` and source PDF files under `Resources/`; it does not need Python, Tesseract, `uv`, `.env`, `LLM_API_KEY`, a database, or runtime environment variables.

## Check Production Locally

Use this path after the app-only setup when you want confidence that the production build and server work locally.

Run order:

```bash
npm run build
npm run start
```

Then smoke-check:

- `/` renders the comparison table;
- `/api/epds` returns a JSON response with an `epds` array;
- clicking a reported carbon value opens source details and a PDF preview.

`npm run build` runs `npm run validate:data` before `next build`, so invalid EPD JSON blocks the production build.

## Regenerate Data From PDFs

Use this optional path only when you need to recreate files in `data/` from PDF source documents.

Additional requirements:

- Python 3.11+;
- `uv`;
- Tesseract available on `PATH`;
- an `LLM_API_KEY`.

Run order:

```bash
uv sync
cp .env.example .env
```

Set `LLM_API_KEY` in `.env` or in your shell. The other variables in `.env.example` are optional defaults.

Then run extraction and verify the generated app data:

```bash
npm run extract
npm run validate:data
npm run dev
```

Open `http://localhost:3000` and inspect the generated records in the comparison table and PDF source drawer.

To run extraction for one PDF:

```bash
npm run extract -- --pdf EPD_HUB-5555_2026-06-27_en.pdf
```

## Convert Existing Raw OCR Only

Use this optional path when `.extraction-raw/*.json` already exists and you only need to convert those raw OCR files into validated app JSON. This skips PDF OCR but still needs `LLM_API_KEY`.

Run order:

```bash
cp .env.example .env
npm run convert:schema
npm run validate:data
npm run dev
```

Set `LLM_API_KEY` in `.env` or in your shell before running `npm run convert:schema`.

## Environment Variables

Normal app usage does not require environment variables.

The extraction tooling can read `.env` through `scripts/extract-epds/io.ts`. Supported variables are:

- `LLM_API_KEY`: required for `npm run extract` and `npm run convert:schema`;
- `LLM_MODEL`: optional model override;
- `LLM_API_URL`: optional API base URL override;
- `OCR_DPI`: optional OCR rendering DPI.
