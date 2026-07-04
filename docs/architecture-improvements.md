# Architecture Improvements

This note captures the main gaps in the current architecture and the next improvements worth considering. The focus is automation and a database-backed architecture.

## Current Gaps

The current architecture is intentionally simple, but it has two clear limits:

- extraction is manually triggered;
- validated EPD data is stored as repository files instead of a queryable backend.

## Automation

A stronger next version should turn extraction into a controlled pipeline:

- accept new PDF uploads or scheduled PDF drops;
- run OCR, LLM conversion, and schema validation automatically;
- preserve raw OCR output and validation errors for audit;
- require a human review step before publishing extracted records;
- publish only records that pass validation and provenance checks.

Useful workflow states would be `uploaded`, `extracted`, `validated`, `needs_review`, `published`, and `failed`.

## Database and Storage

A database becomes useful once the catalog grows, records need editing, or users need server-side search and history.

- Use Postgres for EPD metadata, lifecycle values, source evidence, workflow state, and version history.
- Use object storage for PDFs and raw OCR artifacts instead of keeping all source files in Git.
- Keep `epdSchema` as the validation boundary when importing or serving records.
- Add a repository layer behind `getEpds()` so the UI and API can move from file reads to database queries with minimal frontend impact.

This would allow pagination, filtering, admin review queues, reprocessing jobs, and traceable data updates without changing the comparison rules.
