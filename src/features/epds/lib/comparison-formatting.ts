import { lifecycleModules, type Epd, type LifecycleModule } from "@/shared/epd/schema";

export function formatCarbonValue(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0
  }).format(value);
}

export function carbonStatusLabel(status: Epd["lifeCycleGwp"][number]["status"]) {
  switch (status) {
    case "reported":
      return "Reported";
    case "not_declared":
      return "Not declared";
    case "not_found":
      return "Declared but not extracted";
    case "ambiguous":
      return "Declared but not verified";
  }
}

export function carbonStatusMeta(status: Epd["lifeCycleGwp"][number]["status"]) {
  switch (status) {
    case "reported":
      return "Verified value";
    case "not_declared":
      return "EPD marks this module as ND.";
    case "not_found":
      return "No verified value was extracted.";
    case "ambiguous":
      return "Evidence exists, but was not verified.";
  }
}

export function strengthLabel(epd: Epd) {
  const strength = epd.compressiveStrength;
  return strength.status === "reported" && strength.value !== null
    ? `${strength.value} ${strength.unit}`
    : "Not found";
}

export function moduleLabel(module: LifecycleModule) {
  return module === "B1-B7" ? "B stages" : module;
}

export function moduleTitle(module: LifecycleModule) {
  if (module === "B1-B7") {
    return "Use stage: use, maintenance, repair, replacement, refurbishment, operational energy and water.";
  }

  if (module === "D") {
    return "Benefits and loads beyond the system boundary.";
  }

  return undefined;
}

export function sourceTableLabel(quote: string) {
  if (/Distribution stage/i.test(quote)) {
    return "Distribution stage table";
  }

  if (/environmental performance|primary environmental indicators|potential environmental impacts/i.test(quote)) {
    return "Environmental performance table";
  }

  return "GWP results table";
}

export function sourceRowLabel(quote: string) {
  return /GWP\s*-\s*total|GWP-total|GWP-tot|Global Warming Pot\./i.test(quote)
    ? "GWP-total"
    : "GWP row";
}

export function sourceReferenceLabel(page: number, table: string, row: string) {
  return `p.${page} / ${table} / ${row}`;
}

export type TotalGwpResult =
  | { status: "complete"; total: number; unit: string }
  | { status: "incomplete"; partialSum: number; missingModules: string[]; unit: string }
  | { status: "no_data" };

const FOCUSED_MODULES = ["A1-A3", "A4", "A5"] as const;
const LIFE_CYCLE_AC_MODULES = lifecycleModules.filter((module) => module !== "D");

/**
 * Honest GWP total: only sums A1-A3 + A4 + A5.
 * Returns "incomplete" if any of the three stages is missing/ND —
 * a not-declared stage is NEVER treated as zero.
 */
export function calculateA1A5Total(epd: Epd): TotalGwpResult {
  return calculateModuleTotal(epd, FOCUSED_MODULES);
}

export function calculateLifeCycleACTotal(epd: Epd): TotalGwpResult {
  return calculateModuleTotal(epd, LIFE_CYCLE_AC_MODULES);
}

function calculateModuleTotal(epd: Epd, modules: readonly LifecycleModule[]): TotalGwpResult {
  let partialSum = 0;
  let unit = "kg CO₂e/m³";
  let hasAnyData = false;
  const missingModules: string[] = [];

  for (const mod of modules) {
    const entry = epd.lifeCycleGwp.find((g) => g.module === mod);
    if (entry && entry.status === "reported" && entry.value !== null) {
      partialSum += entry.value;
      if (entry.unit) unit = entry.unit;
      hasAnyData = true;
    } else {
      missingModules.push(moduleLabel(mod));
    }
  }

  if (missingModules.length === 0) {
    return { status: "complete", total: partialSum, unit };
  }

  if (!hasAnyData) {
    return { status: "no_data" };
  }

  return { status: "incomplete", partialSum, missingModules, unit };
}

export type RowStatus =
  | {
      label: "Complete";
      detail: string;
      missingModules: string[];
    }
  | {
      label: "Incomplete";
      detail: string;
      missingModules: string[];
    }
  | {
      label: "Needs normalization";
      detail: string;
      missingModules: string[];
    };

export function rowStatus(epd: Epd): RowStatus {
  if (epd.declaredUnit !== "1 m³") {
    return {
      label: "Needs normalization",
      detail: "Declared unit is different and must be converted before comparison.",
      missingModules: []
    };
  }

  const lifeCycleTotal = calculateLifeCycleACTotal(epd);
  if (lifeCycleTotal.status === "incomplete") {
    return {
      label: "Incomplete",
      detail: "One or more required modules are not declared.",
      missingModules: lifeCycleTotal.missingModules
    };
  }

  if (lifeCycleTotal.status === "no_data") {
    return {
      label: "Incomplete",
      detail: "One or more required modules are not declared.",
      missingModules: LIFE_CYCLE_AC_MODULES.map(moduleLabel)
    };
  }

  return {
    label: "Complete",
    detail: "All required modules are declared.",
    missingModules: []
  };
}

export function productDisplay(epd: Epd) {
  const normalized = epd.productName.replace(/\s+/g, " ").trim();
  const holcimMatch = normalized.match(
    /^([A-Z]{2,3})\s+-\s+(.+?)\s+-\s+ECOPact\s*-?\s+([A-Z0-9]+)(?:\s+-\s+(.+))?$/i
  );

  if (holcimMatch) {
    const region = `${holcimMatch[1].toUpperCase()} ${holcimMatch[2]}`.replace(/\s+/g, " ").trim();
    const description = (holcimMatch[4] ?? "").replace(/\s+use$/i, "").trim();
    return {
      name: `ECOPact ${holcimMatch[3]}`,
      region,
      description,
      meta: [epd.manufacturer, region, description].filter(Boolean).join(" / ")
    };
  }

  const codeMatch =
    normalized.match(/\b([A-Z]{1,3}\d{2,}[A-Z0-9]*)\b/) ??
    epd.sourcePdf.toUpperCase().match(/\b([A-Z]{1,3}\d{2,}[A-Z0-9]*)\b/);
  const name = codeMatch ? codeMatch[1] : normalized;

  return {
    name,
    region: epd.manufacturingLocation ?? "Location not found",
    description: codeMatch ? normalized : "",
    meta: [epd.manufacturer, epd.manufacturingLocation, codeMatch ? normalized : ""]
      .filter(Boolean)
      .join(" / ")
  };
}
