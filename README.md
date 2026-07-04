# Low Carbon Materials Hub

Author: Hanh Tran

Low Carbon Materials Hub is a Next.js application for comparing concrete Environmental Product Declarations (EPDs). It shows embodied carbon by lifecycle stage, keeps missing values visible, and links reported carbon figures back to the source PDF evidence used during extraction.

The project is useful when product comparisons need to stay traceable. Instead of treating missing lifecycle modules as zero, the UI marks incomplete totals and lets users inspect the page and quote behind each reported value.

## Features

- Compare concrete EPDs by manufacturer, location, strength, and lifecycle module.
- View A1-A5 upfront totals and A-C lifecycle totals only when the required modules are reported.
- Keep not-declared, not-found, and ambiguous values explicit in the table.
- Open source PDF evidence for reported carbon values from the comparison UI.
- Validate all JSON data against the same Zod schema used by the app.
- Run optional offline PDF extraction to convert source EPD PDFs into traceable JSON.

## Which Path Do I Need?

| Goal | Run order |
| --- | --- |
| Use the app with existing checked-in data | `npm install` -> `npm run validate:data` -> `npm run dev` |
| Check the production server locally | `npm run build` -> `npm run start` |
| Regenerate extraction data from PDFs | Follow [Local Setup](./docs/local-setup.md#regenerate-data-from-pdfs). This optional path needs Python, Tesseract, `uv`, and `LLM_API_KEY`. |

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Zod
- tsx for local TypeScript scripts
- Python, PyMuPDF, Tesseract, and `uv` for optional PDF extraction

## Quick Start

Use this path to run the app with the JSON data already committed in `data/`. It does not require Python, Tesseract, `uv`, `.env`, or `LLM_API_KEY`.

Install dependencies:

```bash
npm install
```

Validate the included EPD data:

```bash
npm run validate:data
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Production Check

Build the app:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

`npm run build` runs `npm run validate:data` before `next build`, so invalid EPD JSON blocks production builds.

## Deployment

Deploy this repository to Vercel as a standard Next.js app:

- import the Git repository in Vercel;
- use the Next.js framework preset;
- keep the default install command unless your project settings require otherwise;
- use `npm run build` as the build command;
- use Vercel's default Next.js output settings.

The current app does not require runtime environment variables on Vercel. Environment variables are only needed for offline extraction or schema conversion. See [Vercel Deployment](./docs/vercel-deployment.md) for the full checklist.

## Data and Provenance

The application reads validated JSON files from `data/` and serves source PDFs from `Resources/`. Source carbon values are traceable to `Resources/*.pdf` through each JSON value's source page and quote.

## Documentation

- [Documentation Index](./docs/README.md)
- [Local Setup](./docs/local-setup.md)
- [Vercel Deployment](./docs/vercel-deployment.md)
- [Architecture](./docs/architecture.md)
- [Data Model](./docs/data-model.md)
- [Extraction Pipeline](./docs/extraction-pipeline.md)
- [Frontend and API](./docs/frontend-and-api.md)
- [Operations](./docs/operations.md)

## Help and Maintenance

Start with [Local Setup](./docs/local-setup.md) for day-to-day development and [Operations](./docs/operations.md) for validation, extraction, and troubleshooting. Keep `src/shared/epd/schema.ts` as the source of truth for EPD JSON shape, and run `npm run validate:data` after changing files in `data/`.
