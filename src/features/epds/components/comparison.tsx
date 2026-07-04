"use client";

import { useMemo, useState } from "react";
import type { Epd } from "@/shared/epd/schema";
import { calculateA1A5Total } from "../lib/comparison-formatting";
import { ComparisonTable } from "./comparison-table";
import type { SourceSelection, WarningItem } from "./comparison-types";
import { SearchableMultiSelect } from "./searchable-multi-select";
import { SourceDrawer } from "./source-drawer";

const focusedModules = ["A1-A3", "A4", "A5"] as const;

export function Comparison({ epds }: { epds: Epd[] }) {
  const [minStrength, setMinStrength] = useState("");
  const [locationsFilter, setLocationsFilter] = useState<string[]>([]);
  const [manufacturersFilter, setManufacturersFilter] = useState<string[]>([]);
  const [selection, setSelection] = useState<SourceSelection>(null);

  const locations = useMemo(
    () =>
      Array.from(
        new Set(epds.map((epd) => epd.manufacturingLocation).filter(Boolean) as string[])
      ).sort(),
    [epds]
  );

  const manufacturers = useMemo(
    () => Array.from(new Set(epds.map((epd) => epd.manufacturer))).sort(),
    [epds]
  );

  const filtered = useMemo(() => {
    const minimum = minStrength === "" ? null : Number(minStrength);
    return epds
      .filter((epd) => {
        const strength = epd.compressiveStrength.value;
        return minimum === null || (strength !== null && strength >= minimum);
      })
      .filter(
        (epd) =>
          locationsFilter.length === 0 ||
          (epd.manufacturingLocation !== null &&
            locationsFilter.includes(epd.manufacturingLocation))
      )
      .filter(
        (epd) =>
          manufacturersFilter.length === 0 || manufacturersFilter.includes(epd.manufacturer)
      )
      .sort((a, b) => {
        const aTotal = calculateA1A5Total(a);
        const bTotal = calculateA1A5Total(b);
        const aVal =
          aTotal.status === "complete"
            ? aTotal.total
            : aTotal.status === "incomplete"
              ? aTotal.partialSum
              : Infinity;
        const bVal =
          bTotal.status === "complete"
            ? bTotal.total
            : bTotal.status === "incomplete"
              ? bTotal.partialSum
              : Infinity;
        return aVal - bVal;
      });
  }, [epds, locationsFilter, manufacturersFilter, minStrength]);

  const warningItems = useMemo(() => getWarningItems(filtered), [filtered]);

  return (
    <>
      <div className="filters" aria-label="Comparison filters">
        <div className="filter">
          <label htmlFor="minStrength">Minimum strength</label>
          <input
            id="minStrength"
            min="0"
            placeholder="Any MPa"
            type="number"
            value={minStrength}
            onChange={(event) => setMinStrength(event.target.value)}
          />
        </div>
        <SearchableMultiSelect
          allLabel="All locations"
          label="Manufacturing location"
          options={locations}
          selected={locationsFilter}
          onChange={setLocationsFilter}
        />
        <SearchableMultiSelect
          allLabel="All manufacturers"
          label="Manufacturer"
          options={manufacturers}
          selected={manufacturersFilter}
          onChange={setManufacturersFilter}
        />
      </div>

      {warningItems.length > 0 ? (
        <aside className="dataNotes" aria-label="Comparison notes">
          <ul className="dataNoteList">
            {warningItems.map((item) => (
              <li className="dataNote" key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      <ComparisonTable epds={filtered} onSelect={setSelection} />

      {selection ? <SourceDrawer selection={selection} onClose={() => setSelection(null)} /> : null}
    </>
  );
}

function getWarningItems(epds: Epd[]) {
  const declaredUnits = Array.from(new Set(epds.map((epd) => epd.declaredUnit ?? "unknown")));
  const warningItems = [
    declaredUnits.length > 1
      ? {
          label: "Units differ",
          detail: "Declared units differ in this view; compare only like-for-like products."
        }
      : null,
    epds.some((epd) =>
      focusedModules.some((mod) => {
        const item = epd.lifeCycleGwp.find((g) => g.module === mod);
        return !item || item.status !== "reported" || item.value === null;
      })
    )
      ? {
          label: "Partial totals",
          detail:
            "One or more products have missing data in A1-A3, A4, or A5. Not-declared stages are excluded from Total GWP — they are never treated as zero."
        }
      : null,
    epds.some((epd) =>
      epd.lifeCycleGwp.some((item) => item.module === "D" && item.status === "reported")
    )
      ? {
          label: "Module D",
          detail: "Module D is shown separately because it is beyond the system boundary."
        }
      : null
  ];

  return warningItems.filter((item): item is WarningItem => item !== null);
}
