"use client";

import { lifecycleModules, type Epd, type LifecycleModule } from "@/shared/epd/schema";
import {
  calculateA1A5Total,
  calculateLifeCycleACTotal,
  carbonStatusLabel,
  carbonStatusMeta,
  formatCarbonValue,
  moduleLabel,
  moduleTitle,
  productDisplay,
  rowStatus,
  sourceReferenceLabel,
  sourceRowLabel,
  sourceTableLabel,
  strengthLabel
} from "../lib/comparison-formatting";
import type { SourceSelection } from "./comparison-types";

export function ComparisonTable({
  epds,
  onSelect
}: {
  epds: Epd[];
  onSelect: (selection: NonNullable<SourceSelection>) => void;
}) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr className="groupHeader">
            <th className="stickyProductGroup" colSpan={4}>
              Product info
            </th>
            <th colSpan={1}>Product stage</th>
            <th colSpan={2}>Construction</th>
            <th colSpan={1}>Use</th>
            <th colSpan={4}>End of life</th>
            <th colSpan={1}>Beyond boundary</th>
            <th colSpan={2}>Honest total</th>
            <th colSpan={1}>Status</th>
          </tr>
          <tr>
            <th className="stickyCol productCol">Product</th>
            <th className="stickyCol strengthCol">Strength</th>
            <th className="stickyCol locationCol">Location</th>
            <th className="stickyCol unitCol">Declared Unit</th>
            {lifecycleModules.map((module) => (
              <th key={module} title={moduleTitle(module)}>
                {moduleLabel(module)}
              </th>
            ))}
            <th
              className="totalCol"
              title="A1-A3 + A4 + A5. Complete only when all three stages are reported; otherwise the table shows a warned helper sum of reported stages."
            >
              Upfront A1–A5
            </th>
            <th
              className="totalCol"
              title="A1-A3 + A4 + A5 + B stages + C1 + C2 + C3 + C4. Complete only when all required modules are reported; otherwise the table shows a warned helper sum."
            >
              Life cycle A–C
            </th>
            <th className="statusCol">Status</th>
          </tr>
        </thead>
        <tbody>
          {epds.map((epd) => {
            const product = productDisplay(epd);
            const upfrontTotal = calculateA1A5Total(epd);
            const lifeCycleTotal = calculateLifeCycleACTotal(epd);
            const status = rowStatus(epd);

            return (
              <tr key={epd.id}>
                <td className="stickyCol productCol" title={epd.sourcePdf}>
                  <button
                    className="productTitleButton"
                    type="button"
                    title={`Preview original PDF: ${epd.sourcePdf}`}
                    onClick={() =>
                      onSelect({
                        kind: "product_pdf",
                        product: product.name,
                        sourcePdf: epd.sourcePdf
                      })
                    }
                  >
                    <strong>{product.name}</strong>
                  </button>
                  <span className="meta">{product.meta}</span>
                </td>
                <td className="stickyCol strengthCol">{strengthLabel(epd)}</td>
                <td className="stickyCol locationCol">{epd.manufacturingLocation ?? "Not found"}</td>
                <td className="stickyCol unitCol">{epd.declaredUnit ?? "Not found"}</td>

                {lifecycleModules.map((module: LifecycleModule) => {
                  const item = epd.lifeCycleGwp.find((candidate) => candidate.module === module);

                  if (!item) {
                    return (
                      <td className="ndCell carbonCell" key={module}>
                        <strong>⚠️ ND</strong>
                        <span className="meta">Not extracted</span>
                      </td>
                    );
                  }

                  const carbonValue = item.value;
                  const source = item.source;
                  const table = source ? sourceTableLabel(source.quote) : "";
                  const row = source ? sourceRowLabel(source.quote) : "";

                  if (item.status === "reported" && carbonValue !== null && source) {
                    return (
                      <td className="carbonCell" key={module}>
                        <button
                          className="sourceButton"
                          type="button"
                          title={`Source: ${sourceReferenceLabel(source.page, table, row)}`}
                          onClick={() =>
                            onSelect({
                              kind: "reported",
                              product: product.name,
                              module: moduleLabel(module),
                              value: formatCarbonValue(carbonValue),
                              unit: item.unit ?? "",
                              sourcePdf: epd.sourcePdf,
                              page: source.page,
                              table,
                              row,
                              quote: source.quote
                            })
                          }
                        >
                          <strong>
                            {formatCarbonValue(carbonValue)}
                            <span className="infoBadge">i</span>
                          </strong>
                          <span className="meta">{item.unit}</span>
                          <span className="sourceHint">
                            {sourceReferenceLabel(source.page, table, row)}
                          </span>
                        </button>
                      </td>
                    );
                  }

                  return (
                    <td className="ndCell carbonCell" key={module}>
                      <button
                        className="ndButton"
                        type="button"
                        title={`${carbonStatusLabel(item.status)} — click for source reference`}
                        onClick={() =>
                          onSelect({
                            kind: "nd",
                            product: product.name,
                            module: moduleLabel(module),
                            statusLabel: carbonStatusLabel(item.status),
                            statusMeta: carbonStatusMeta(item.status),
                            sourcePdf: epd.sourcePdf,
                            page: source?.page ?? null,
                            quote: source?.quote ?? null
                          })
                        }
                      >
                        <strong>⚠️ ND</strong>
                        <span className="meta">{carbonStatusMeta(item.status)}</span>
                      </button>
                    </td>
                  );
                })}

                <td
                  className={
                    upfrontTotal.status === "complete"
                      ? "totalCell completeTotalCell carbonCell"
                      : "totalCell ndCell carbonCell"
                  }
                >
                  {upfrontTotal.status === "complete" ? (
                    <>
                      <strong className="totalValue">{formatCarbonValue(upfrontTotal.total)}</strong>
                      <span className="meta">{upfrontTotal.unit}</span>
                    </>
                  ) : upfrontTotal.status === "incomplete" ? (
                    <button
                      className="ndButton"
                      type="button"
                      title="Partial helper total only — click for details"
                      onClick={() =>
                        onSelect({
                          kind: "total_incomplete",
                          product: product.name,
                          title: "Incomplete upfront A1–A5",
                          partialValue: formatCarbonValue(upfrontTotal.partialSum),
                          unit: upfrontTotal.unit,
                          missingModules: upfrontTotal.missingModules
                        })
                      }
                    >
                      <strong>⚠️ Incomplete</strong>
                      <strong className="partialTotalValue">
                        &gt; {formatCarbonValue(upfrontTotal.partialSum)}
                      </strong>
                      <span className="meta">{upfrontTotal.unit}</span>
                      <span className="meta">Missing {upfrontTotal.missingModules.join(", ")}</span>
                    </button>
                  ) : (
                    <>
                      <strong>⚠️ ND</strong>
                      <span className="meta">No A-stage data</span>
                    </>
                  )}
                </td>

                <td
                  className={
                    lifeCycleTotal.status === "complete"
                      ? "totalCell completeTotalCell carbonCell"
                      : "totalCell ndCell carbonCell"
                  }
                >
                  {lifeCycleTotal.status === "complete" ? (
                    <>
                      <strong className="totalValue">
                        {formatCarbonValue(lifeCycleTotal.total)}
                      </strong>
                      <span className="meta">{lifeCycleTotal.unit}</span>
                    </>
                  ) : lifeCycleTotal.status === "incomplete" ? (
                    <button
                      className="ndButton"
                      type="button"
                      title="Partial helper total only — click for details"
                      onClick={() =>
                        onSelect({
                          kind: "total_incomplete",
                          product: product.name,
                          title: "Incomplete life cycle A–C",
                          partialValue: formatCarbonValue(lifeCycleTotal.partialSum),
                          unit: lifeCycleTotal.unit,
                          missingModules: lifeCycleTotal.missingModules
                        })
                      }
                    >
                      <strong>⚠️ Incomplete</strong>
                      <strong className="partialTotalValue">
                        &gt; {formatCarbonValue(lifeCycleTotal.partialSum)}
                      </strong>
                      <span className="meta">{lifeCycleTotal.unit}</span>
                      <span className="meta">Missing {lifeCycleTotal.missingModules.join(", ")}</span>
                    </button>
                  ) : (
                    <>
                      <strong>⚠️ ND</strong>
                      <span className="meta">No A-C data</span>
                    </>
                  )}
                </td>

                <td className="statusCol">
                  <button
                    className={`statusButton status-${status.label.toLowerCase().replaceAll(" ", "-")}`}
                    type="button"
                    onClick={() =>
                      onSelect({
                        kind: "row_status",
                        product: product.name,
                        statusLabel: status.label,
                        detail: status.detail,
                        missingModules: status.missingModules
                      })
                    }
                  >
                    {status.label}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
