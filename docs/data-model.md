# Data Model

## Source of Truth

The canonical schema is `src/shared/epd/schema.ts`. All `data/*.json` files must parse through this schema before the app can serve them.

The schema is intentionally strict around reported values:

- reported lifecycle GWP values require `value`, `unit`, and `source`;
- non-reported lifecycle values must have `value: null`;
- reported compressive strength requires `value`, `unit`, and `source`;
- `declaredUnit` normalizes `"1 m3"` to `"1 m³"` at parse time.

## EPD Object

Each `data/*.json` file contains one EPD object:

```ts
type Epd = {
  id: string;
  sourcePdf: string;
  productName: string;
  manufacturer: string;
  declaredUnit: string | null;
  manufacturingLocation: string | null;
  compressiveStrength: SourcedNumber;
  lifeCycleGwp: LifecycleGwp[];
  comparabilityNotes: string[];
  dataQualityFlags: string[];
};
```

## Sourced Number

`compressiveStrength` uses a generic sourced number shape:

```ts
type SourcedNumber = {
  value: number | null;
  unit: string | null;
  status: "reported" | "not_declared" | "not_found" | "ambiguous";
  source: Source | null;
};
```

The UI displays reported compressive strength as `{value} {unit}`. Otherwise it displays `Not found`.

## Source Evidence

```ts
type Source = {
  page: number;
  quote: string;
};
```

The `page` is a positive, 1-based PDF page number. The `quote` is the evidence string shown in the source drawer or used to label the source table and row.

## Lifecycle Modules

The app compares the following lifecycle modules:

```text
A1-A3  Product stage
A4     Transport to site
A5     Construction/installation
B1-B7  Use-stage bundle
C1     Deconstruction/demolition
C2     Transport
C3     Waste processing
C4     Disposal
D      Benefits and loads beyond the system boundary
```

Every EPD JSON file is expected to include one entry for each module. `scripts/validate-data.ts` rejects missing or duplicate module entries.

## Lifecycle GWP Entry

```ts
type LifecycleGwp = {
  module: LifecycleModule;
  value: number | null;
  unit: string | null;
  status: FieldStatus;
  source: Source | null;
  verification: {
    status: "supported" | "contradicted" | "not_found" | "ambiguous";
    confidence: number;
  };
};
```

## Field Statuses

### `reported`

A numeric value was extracted and has source evidence. For lifecycle GWP values, the schema requires:

- `value` is a number;
- `unit` is a string;
- `source` includes a page and quote.

### `not_declared`

The EPD marks the value as not declared, missing, blank, or unavailable. The value must be `null`.

### `not_found`

The extraction process did not find a verified value. The value must be `null`.

### `ambiguous`

Evidence exists but cannot be verified as a single supported value. The value must be `null`.

## Verification Statuses

Verification status captures confidence in the source evidence, separate from field presence:

- `supported`: the extracted value is supported by available evidence;
- `contradicted`: evidence conflicts with the value;
- `not_found`: no supporting evidence was found;
- `ambiguous`: evidence was inconclusive.

The UI currently uses the field `status` for display decisions and keeps `verification` available for future audit workflows.

## Provenance Invariants

Reported carbon values are only useful if they are traceable. The schema and extraction tooling enforce these invariants:

- no reported lifecycle GWP value without a numeric value;
- no reported lifecycle GWP value without a unit;
- no reported lifecycle GWP value without source page and quote;
- no non-reported lifecycle GWP value with a numeric value;
- no reported compressive strength without source evidence;
- no missing lifecycle modules in final JSON files.

For `A1-A3`, `scripts/extract-epds/schema-json.ts` adds extra validation that the source quote identifies Product stage or equivalent primary/core environmental indicators and `GWP-total`, while rejecting forbidden evidence such as Additional indicators or non-product-stage tables.

## Current Data Set

Current repository contents:

- 20 EPD JSON files in `data/`;
- 20 source PDFs in `Resources/`;
- 142 reported lifecycle GWP values;
- 17 products with at least one `dataQualityFlags` entry;
- 11 manufacturers;
- 15 manufacturing locations;
- declared unit variants found in source JSON: `1 m3` and `1 m³`.

Because `declaredUnit` is normalized during schema parsing, app consumers should compare against `1 m³`.

## Example

```json
{
  "module": "A1-A3",
  "value": 220,
  "unit": "kg CO2e",
  "status": "reported",
  "source": {
    "page": 13,
    "quote": "Core environmental impact indicators ... GWP - total ... A1-A3 ... 2.20E+02"
  },
  "verification": {
    "status": "supported",
    "confidence": 0.9
  }
}
```

## Data Quality Flags

`dataQualityFlags` are human-readable warnings attached to an EPD. They are surfaced in row status and source-detail flows indirectly today, and they should be preserved when adding richer audit views.

Common flag categories include:

- manufacturing sites grouped together;
- variation ranges in reported GWP values;
- units that may require normalization;
- extraction uncertainty.
