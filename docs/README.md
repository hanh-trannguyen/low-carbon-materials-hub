# Documentation Index

This directory contains the deeper technical documentation for Low Carbon Materials Hub. For the project overview and quickest start, use the root [README](../README.md).

## Start Here

- First run of the app: use the root [README](../README.md).
- Local command sequences by task: use [Local Setup](./local-setup.md).
- Command lookup, adding EPDs, and troubleshooting: use [Operations](./operations.md).
- Extraction internals and evidence handling: use [Extraction Pipeline](./extraction-pipeline.md).
- Production hosting: use [Vercel Deployment](./vercel-deployment.md).

## Technical References

- [Architecture](./architecture.md) explains the application shape, module boundaries, request flow, and data flow.
- [Architecture Improvements](./architecture-improvements.md) summarizes future automation and database-backed architecture ideas.
- [Data Model](./data-model.md) documents the EPD schema, lifecycle module statuses, and provenance invariants.
- [Extraction Pipeline](./extraction-pipeline.md) explains how PDFs are converted into validated JSON.
- [Frontend and API](./frontend-and-api.md) documents the UI components, API routes, and comparison behavior.

## Repository at a Glance

```text
src/
  app/                    Next.js App Router pages, layout, global styles, API routes
  features/epds/          EPD comparison UI and formatting logic
  server/epds/            Server-side JSON loading
  shared/epd/             Shared Zod schema and TypeScript types
scripts/
  extract-epds.ts         End-to-end extraction orchestrator
  extract-epds/           TypeScript extraction helpers
  extract_raw_pdf.py      PyMuPDF/Tesseract raw OCR extractor
  validate-data.ts        Data validation command used by build
data/                     Validated EPD JSON files consumed by the app
Resources/                Source EPD PDFs served for provenance previews
```

## Current System Snapshot

- Framework: Next.js 15 with React 19 and TypeScript.
- Validation: Zod schema shared by scripts, server code, and app types.
- Source data: 20 EPD JSON files in `data/`.
- Source evidence: 20 source PDFs in `Resources/`.
- Runtime data loading: filesystem read from `data/*.json` through the `/api/epds` route.
- Provenance: every reported lifecycle carbon value must include a source page and quote.

## Core Design Principle

The app is intentionally conservative. A missing or not-declared lifecycle stage is never treated as zero, and totals are only shown as complete when every required module for that total has a reported value. The interface is designed around traceability: clicking a reported carbon value opens the source PDF evidence used for extraction.
