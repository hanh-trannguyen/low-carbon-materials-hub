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

## Comparability Guardrails

A future version should warn users when EPD products may not be meaningfully comparable, even if their reported carbon modules can be displayed side by side. This should be treated as a data, model, and UI capability rather than current behavior.

Future EPD records should extract and store sourced comparability metadata:

- `programmeOperator`
- `programmeName`
- `pcrName`
- `pcrVersion`
- `standard`
- `standardAmendment`
- optional `cPcrName`

Comparison warnings should be based on metadata mismatches, not only on missing lifecycle modules. PCRs are intended to make LCA and EPD results consistent inside a product category and support comparability, while EN 15804+A2 defines core PCR rules and comparison conditions for construction-product EPDs. For concrete, concrete-specific c-PCR rules such as EN 16757:2022 may also apply alongside EN 15804+A2.

Initial concrete-specific checks should:

- warn if programme operators differ unless they are known to be mutually recognized or ECO Platform-aligned;
- warn if PCR family or version differs, for example `Concrete PCR v1` versus `Concrete PCR v2`;
- warn strongly if the standard differs, especially `EN 15804+A1` versus `EN 15804+A2`, because indicator sets and reporting rules can differ;
- warn if lifecycle scope, declared unit, or product function and use context differs.

The UI should present this as a "Comparability caution" rather than a hard blocker. Some EPDs can remain valid under the programme, PCR, or general programme instructions used at verification time, but still not be directly comparable without expert review. Each extracted comparability field should retain source evidence, including page and quote, using the same provenance discipline as carbon values.

The likely implementation shape is:

- extend the EPD schema with a `comparability` object and sourced fields for programme, PCR, standard, and c-PCR metadata;
- update extraction prompts to capture programme operator, PCR name and version, EN standard version, and concrete c-PCR where present;
- add a pure comparison utility that returns `comparable`, `caution`, or `not_recommended` plus plain-language reasons;
- surface the result in table-level notes and the row or source drawer for non-expert users.

Future tests should cover same programme, PCR, and standard metadata; different PCR versions; `EN 15804+A1` versus `EN 15804+A2`; and missing metadata. Missing metadata should produce `caution`, not false confidence, and existing carbon totals and current comparison logic should remain unchanged until this feature is implemented.

References: [EPD International on PCRs](https://www.environdec.com/services/what-is-pcr), [BSI EN 15804+A2](https://knowledge.bsigroup.com/products/sustainability-of-construction-works-environmental-product-declarations-core-rules-for-the-product-category-of-construction-products-2), [BSI EN 16757:2022](https://knowledge.bsigroup.com/products/sustainability-of-construction-works-environmental-product-declarations-product-category-rules-for-concrete-and-concrete-elements-1), [ECO Platform on EPD comparison](https://www.eco-platform.org/eco-epd-40.html), and [EPD International General Programme Instructions](https://www.environdec.com/resources/general-programme-instructions).
