export type SourceSelection =
  | {
      kind: "reported";
      product: string;
      module: string;
      value: string;
      unit: string;
      sourcePdf: string;
      page: number;
      table: string;
      row: string;
      quote: string;
    }
  | {
      kind: "nd";
      product: string;
      module: string;
      statusLabel: string;
      statusMeta: string;
      sourcePdf: string;
      page: number | null;
      quote: string | null;
    }
  | {
      kind: "total_incomplete";
      product: string;
      title: string;
      missingModules: string[];
    }
  | {
      kind: "row_status";
      product: string;
      statusLabel: string;
      detail: string;
      missingModules: string[];
    }
  | {
      kind: "product_pdf";
      product: string;
      sourcePdf: string;
    }
  | null;

export type WarningItem = {
  label: string;
  detail: string;
};
