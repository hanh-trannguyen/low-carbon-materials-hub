# Frontend and API

## Page Entry

`src/app/page.tsx` renders:

```tsx
<main>
  <EpdHub />
</main>
```

`src/app/layout.tsx` sets global metadata and imports `src/app/globals.css`.

## API Routes

### `GET /api/epds`

Implemented in `src/app/api/epds/route.ts`.

Response:

```json
{
  "epds": []
}
```

The route calls `getEpds()` from `src/server/epds/read-epds.ts`, which:

1. reads `data/`;
2. filters `.json` files;
3. sorts filenames for stable output;
4. parses each JSON file through `epdSchema`;
5. returns typed EPD objects.

### `GET /api/epds/pdf/[file]`

Implemented in `src/app/api/epds/pdf/[file]/route.ts`.

Behavior:

- accepts only `.pdf` filenames;
- decodes the dynamic route parameter;
- strips a leading `Resources/` or `Resources\` prefix if present;
- resolves the target path under `Resources/`;
- rejects paths outside `Resources/`;
- returns the PDF with `Content-Type: application/pdf`;
- returns `404` when the file is missing.

This route supports source previews such as:

```text
/api/epds/pdf/Resources%2FEPD_HUB-5555_2026-06-27_en.pdf#page=13
```

## Component Structure

```text
EpdHub
  Comparison
    SearchableMultiSelect
    ComparisonTable
    SourceDrawer
```

### `EpdHub`

Path: `src/features/epds/components/epd-hub.tsx`

Responsibilities:

- fetch `/api/epds` on mount;
- abort the fetch on unmount;
- render loading, error, and ready states;
- calculate header summary metrics:
  - EPD count;
  - reported carbon value count;
  - products with data quality flags.

### `Comparison`

Path: `src/features/epds/components/comparison.tsx`

Responsibilities:

- manage filter state:
  - minimum compressive strength;
  - manufacturing locations;
  - manufacturers;
- derive unique filter options;
- filter products in memory;
- sort rows by complete or partial A1-A5 result;
- derive top-level warning badges;
- manage selected source drawer state.

Warnings are shown for:

- differing declared units;
- partial A1-A5 totals;
- presence of Module D values.

### `SearchableMultiSelect`

Path: `src/features/epds/components/searchable-multi-select.tsx`

Reusable multi-select control for location and manufacturer filters. It supports:

- popover open/close state;
- search query filtering;
- checkbox-style multi-selection;
- keyboard selection with Enter or Space;
- reset to all values.

### `ComparisonTable`

Path: `src/features/epds/components/comparison-table.tsx`

Responsibilities:

- render product metadata and lifecycle module columns;
- render reported carbon values as clickable source buttons;
- render missing/not-declared/ambiguous values as warning cells;
- calculate and display A1-A5 and A-C totals;
- render row status;
- create typed `SourceSelection` objects for the drawer.

The table has sticky product, strength, and location columns to keep row context visible during horizontal scrolling.

### `SourceDrawer`

Path: `src/features/epds/components/source-drawer.tsx`

The drawer displays details for five selection types from `comparison-types.ts`:

- `reported`: value, unit, source page, table/row label, PDF iframe;
- `nd`: explanation that missing data is not zero, optional source page, quote;
- `total_incomplete`: missing modules preventing total calculation;
- `row_status`: complete/incomplete/normalization explanation;
- `product_pdf`: full source PDF preview.

## Formatting and Comparison Logic

Path: `src/features/epds/lib/comparison-formatting.ts`

Key functions:

- `formatCarbonValue()` formats values with fewer decimals for large numbers.
- `carbonStatusLabel()` and `carbonStatusMeta()` map data statuses to UI text.
- `strengthLabel()` formats compressive strength.
- `moduleLabel()` changes `B1-B7` to `B stages`.
- `sourceTableLabel()` and `sourceRowLabel()` infer source labels from quote text.
- `calculateA1A5Total()` totals `A1-A3 + A4 + A5`.
- `calculateLifeCycleACTotal()` totals all modules except `D`.
- `rowStatus()` returns `Complete`, `Incomplete`, or `Needs normalization`.
- `productDisplay()` normalizes product names for compact table display.

## Total Calculation Behavior

Totals use `calculateModuleTotal()`:

- all required modules reported: `{ status: "complete", total, unit }`;
- some required modules reported: `{ status: "incomplete", partialSum, missingModules, unit }`;
- no required modules reported: `{ status: "no_data" }`.

The UI does not display partial sums as final totals. It shows `Incomplete` and lists missing modules.

## Styling

Global styles live in `src/app/globals.css`.

The stylesheet defines:

- page layout and summary metrics;
- filter layout;
- table, sticky columns, lifecycle cells, and status badges;
- warning and complete-total states;
- source drawer and PDF preview;
- mobile layout below `900px`.

The UI uses plain CSS and no component styling library.

## Client/Server Boundary

All files under `src/features/epds/components` are client components because they use React state, effects, or browser interactions.

Server-only work is kept in:

- `src/server/epds/read-epds.ts`;
- API route handlers under `src/app/api`.

The shared schema is safe to import from either side.
